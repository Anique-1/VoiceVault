import React, {useEffect, useState, useRef} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SectionList,
  Alert, Platform, PermissionsAndroid, Animated, SafeAreaView, StatusBar, Dimensions, Image
} from 'react-native';
import CallRecorderModule from './CallRecorderModule';

const { height, width } = Dimensions.get('window');

type Recording = {
  name: string;
  path: string;
  size: number;
};

type ParsedRecording = Recording & {
  dateObj: Date;
  timeStr: string;
  dateStr: string;
};

type Section = {
  title: string;
  data: ParsedRecording[];
};

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<'Splash' | 'Home' | 'List'>('Splash');
  const [isEnabled, setIsEnabled] = useState(false);
  const [recordings, setRecordings] = useState<Section[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [playbackPos, setPlaybackPos] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(1);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        requestPermissions().then(() => {
          setCurrentScreen('Home');
        });
      }, 1500);
    });

    checkServiceState();
    fetchRecordings();
    
    const interval = setInterval(() => {
      fetchRecordings();
      checkServiceState();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Separate useEffect for playback tracking to avoid stale closures
  useEffect(() => {
    let playInterval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      playInterval = setInterval(async () => {
        try {
          const info = await CallRecorderModule.getPlaybackInfo();
          if (info) {
            setPlaybackPos(info.position);
            setPlaybackDuration(info.duration > 0 ? info.duration : 1);
            setIsPlaybackActive(info.isPlaying);
            
            // Auto stop when reached end
            if (info.duration > 0 && info.position >= info.duration - 300) {
                await CallRecorderModule.stopPlaying();
                setIsPlaying(false);
                setCurrentPath('');
                setPlaybackPos(0);
                setIsPlaybackActive(false);
            }
          } else {
             // Null info usually means stopped/finished
             setIsPlaybackActive(false);
          }
        } catch (e) {}
      }, 500); // 500ms for a smoother scrubber tick
    }
    return () => {
      if (playInterval) clearInterval(playInterval);
    };
  }, [isPlaying]);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        ];

        if (Number(Platform.Version) >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
        if (Number(Platform.Version) < 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        }

        const grants = await PermissionsAndroid.requestMultiple(permissions);
        const allGranted = Object.values(grants).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert('Permissions Required', 'App needs permissions to function correctly.');
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const checkServiceState = async () => {
    try {
      const state = await CallRecorderModule.getServiceState();
      setIsEnabled(state);
    } catch (e) {
      console.log(e);
    }
  };

  const parseRecordings = (raw: Recording[]): Section[] => {
    const parsed: ParsedRecording[] = raw.map(rec => {
      const match = rec.name.match(/_(\d{8})_(\d{6})\./);
      let dateObj = new Date(0);
      let timeStr = 'Unknown Time';
      let dateStr = 'Unknown Date';

      if (match) {
        const d = match[1];
        const t = match[2];
        
        const year = parseInt(d.substring(0,4), 10);
        const month = parseInt(d.substring(4,6), 10) - 1;
        const day = parseInt(d.substring(6,8), 10);
        
        const hour = parseInt(t.substring(0,2), 10);
        const min = parseInt(t.substring(2,4), 10);
        const sec = parseInt(t.substring(4,6), 10);
        
        dateObj = new Date(year, month, day, hour, min, sec);
        
        timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        dateStr = dateObj.toLocaleDateString([], {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
      }

      let cleanName = rec.name.replace('Call_', '').replace('.m4a', '').replace('.3gp', '');
      const numMatch = cleanName.match(/^(.*?)_\d{8}/);
      if (numMatch && numMatch[1]) {
        cleanName = numMatch[1];
      }
      if (cleanName === 'Unknown') cleanName = 'Unknown Number';

      return { ...rec, dateObj, timeStr, dateStr, name: cleanName };
    });

    parsed.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    const groups: {[key: string]: ParsedRecording[]} = {};
    parsed.forEach(p => {
      if (!groups[p.dateStr]) {
        groups[p.dateStr] = [];
      }
      groups[p.dateStr].push(p);
    });

    return Object.keys(groups).map(k => ({
      title: k,
      data: groups[k]
    }));
  };

  const fetchRecordings = async () => {
    try {
      const recs = await CallRecorderModule.getRecordings();
      setRecordings(parseRecordings(recs));
    } catch (e) {
      console.log(e);
    }
  };

  const toggleService = async () => {
    try {
      if (isEnabled) {
        await CallRecorderModule.toggleService(false);
      } else {
        await CallRecorderModule.toggleService(true);
      }
      checkServiceState();
    } catch (e) {
      console.log('Toggle error:', e);
      Alert.alert('Error', 'Could not start or stop the service.');
    }
  };

  const togglePlayPause = async (path: string) => {
    try {
      if (isPlaying && currentPath === path) {
        if (isPlaybackActive) {
          await CallRecorderModule.pausePlaying();
          setIsPlaybackActive(false);
        } else {
          await CallRecorderModule.resumePlaying();
          setIsPlaybackActive(true);
        }
      } else {
        if (isPlaying) {
          await CallRecorderModule.stopPlaying();
        }
        setPlaybackPos(0);
        setIsPlaying(true);
        setCurrentPath(path);
        setIsPlaybackActive(true);
        await CallRecorderModule.playRecording(path);
      }
    } catch (e: any) {
      console.log(e);
      Alert.alert('Error', `Cannot play this recording: ${e.message || 'Unknown error'}`);
      setIsPlaying(false);
      setCurrentPath('');
    }
  };

  const stopAudio = async () => {
    await CallRecorderModule.stopPlaying();
    setIsPlaying(false);
    setCurrentPath('');
    setPlaybackPos(0);
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0'+s : s}`;
  };

  const deleteRecording = (path: string) => {
    Alert.alert('Delete', 'Are you sure you want to delete this recording?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          if (isPlaying && currentPath === path) {
            await CallRecorderModule.stopPlaying();
            setIsPlaying(false);
          }
          await CallRecorderModule.deleteRecording(path);
          fetchRecordings();
        } catch (e) {
          console.log(e);
        }
      }},
    ]);
  };

  if (currentScreen === 'Splash') {
    return (
      <View style={styles.splashContainer}>
        <StatusBar backgroundColor="#B80F53" barStyle="light-content" />
        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Image source={require('./assests/logo.png')} style={styles.splashLogo} resizeMode="contain" />
          <Text style={styles.splashTitle}>VOICE VAULT</Text>
        </Animated.View>
      </View>
    );
  }

  if (currentScreen === 'List') {
    return (
      <SafeAreaView style={styles.listContainer}>
        <StatusBar backgroundColor="#B80F53" barStyle="light-content" />
        
        <View style={styles.listHeader}>
          <TouchableOpacity onPress={() => setCurrentScreen('Home')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{'< BACK'}</Text>
          </TouchableOpacity>
          <Text style={styles.listHeaderTitle}>RECORDINGS</Text>
          <View style={{width: 60}} />
        </View>

        {recordings.length === 0 ? (
           <View style={styles.emptyContainer}>
             <Text style={styles.emptyText}>No recordings available</Text>
           </View>
        ) : (
          <SectionList
            sections={recordings}
            keyExtractor={(item) => item.path}
            contentContainerStyle={styles.listContent}
            renderSectionHeader={({section: {title}}) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{title}</Text>
              </View>
            )}
            renderItem={({item}) => {
              const isThisPlaying = isPlaying && currentPath === item.path;
              const sizeInKb = (item.size / 1024).toFixed(1);
              
              return (
                <View style={styles.recordItem}>
                  <View style={styles.recordRowTop}>
                    <Text style={styles.recordName}>{item.name}</Text>
                    <Text style={styles.recordTime}>{item.timeStr}</Text>
                  </View>
                  <View style={styles.recordRowBottom}>
                    <Text style={styles.recordSize}>{sizeInKb} KB</Text>
                  </View>

                  {isThisPlaying && (
                    <View style={styles.playerContainer}>
                       <View style={styles.scrubberRow}>
                         <Text style={styles.scrubberTime}>{formatTime(playbackPos)}</Text>
                         <View style={styles.scrubberTrack}>
                            <View style={[styles.scrubberFill, { width: `${(playbackPos / playbackDuration) * 100}%` }]} />
                            <View style={[styles.scrubberThumb, { left: `${(playbackPos / playbackDuration) * 100}%` }]} />
                         </View>
                         <Text style={styles.scrubberTime}>{formatTime(playbackDuration)}</Text>
                       </View>
                       
                       <View style={styles.playerButtonsRow}>
                          <TouchableOpacity onPress={() => deleteRecording(item.path)}>
                             <Text style={styles.iconButton}>🗑️</Text>
                          </TouchableOpacity>
                          
                          <View style={styles.centerPlayControls}>
                            <TouchableOpacity onPress={() => togglePlayPause(item.path)}>
                               <Text style={styles.playButtonIcon}>{isPlaybackActive ? '⏸' : '▶'}</Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity onPress={stopAudio}>
                             <Text style={styles.iconButton}>⏹</Text>
                          </TouchableOpacity>
                       </View>
                    </View>
                  )}

                  {!isThisPlaying && (
                    <TouchableOpacity style={styles.hiddenPlayHitbox} onPress={() => togglePlayPause(item.path)} />
                  )}
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // Home Screen
  return (
    <SafeAreaView style={styles.homeContainer}>
      <StatusBar backgroundColor="#FAFAFA" barStyle="dark-content" />
      
      <View style={styles.homeTopHalf}>
        <Text style={styles.greetingText}>Ready to Record</Text>
        <Text style={styles.statusHelperText}>
          {isEnabled ? "Service is running" : "Tap the button to start"}
        </Text>
        
        <View style={styles.circleButtonContainer}>
          <TouchableOpacity 
            style={[styles.recordButtonOuter, isEnabled ? styles.recordButtonOuterActive : {}]}
            onPress={toggleService}
            activeOpacity={0.8}
          >
             <View style={[styles.recordButtonInner, isEnabled ? styles.recordButtonInnerActive : {}]}>
                <Text style={[styles.recordButtonText, { fontSize: 16 }]}>{isEnabled ? 'DISABLE' : 'ENABLE'}</Text>
             </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.homeBottomHalf}>
        <TouchableOpacity 
          style={styles.savedRecordingsBtn}
          onPress={() => setCurrentScreen('List')}
        >
          <View style={styles.savedRecordingsRow}>
            <Text style={styles.savedRecordingsIcon}>📂</Text>
            <Text style={styles.savedRecordingsBtnText}>SAVED RECORDINGS</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {recordings.reduce((acc, curr) => acc + curr.data.length, 0)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Splash
  splashContainer: {
    flex: 1,
    backgroundColor: '#B80F53',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  splashTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: 10,
  },

  // Home Screen
  homeContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  homeTopHalf: {
    flex: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
    marginBottom: 5,
  },
  statusHelperText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 40,
  },
  circleButtonContainer: {
    alignItems: 'center',
  },
  recordButtonOuter: {
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: '#5C1530',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#B80F53',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  recordButtonOuterActive: {
    backgroundColor: '#FFEBEE',
  },
  recordButtonInner: {
    width: 130, height: 130,
    borderRadius: 65,
    backgroundColor: '#B80F53',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonInnerActive: {
    backgroundColor: '#E53935',
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  homeBottomHalf: {
    flex: 1,
    padding: 30,
    justifyContent: 'space-around',
  },
  savedRecordingsBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  savedRecordingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedRecordingsIcon: {
    fontSize: 22,
    marginRight: 15,
  },
  savedRecordingsBtnText: {
    flex: 1,
    color: '#333333',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badge: {
    backgroundColor: '#B80F53',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // List Screen
  listContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#B80F53',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#B80F53',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  backBtn: {
    width: 60,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  listHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  sectionHeader: {
    paddingHorizontal: 25,
    paddingVertical: 15,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B80F53',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  listContent: {
    paddingBottom: 40,
  },
  recordItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  recordRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  recordName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  recordTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  recordRowBottom: {
    flexDirection: 'row',
  },
  recordSize: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9E9E9E',
  },
  
  hiddenPlayHitbox: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    zIndex: 1,
  },
  playerContainer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  scrubberTime: {
    fontSize: 11,
    color: '#B80F53',
    fontWeight: '600',
    width: 35,
    textAlign: 'center',
  },
  scrubberTrack: {
    flex: 1,
    height: 3,
    backgroundColor: '#FFEBEE',
    marginHorizontal: 10,
    position: 'relative',
    justifyContent: 'center',
    borderRadius: 2,
  },
  scrubberFill: {
    width: '30%',
    height: 3,
    backgroundColor: '#B80F53',
    position: 'absolute',
    left: 0,
    borderRadius: 2,
  },
  scrubberThumb: {
    width: 12, height: 12,
    borderRadius: 6,
    backgroundColor: '#5C1530',
    position: 'absolute',
    left: '30%',
    marginLeft: -6,
  },
  playerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centerPlayControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButtonIcon: {
    fontSize: 26,
    color: '#B80F53',
    marginHorizontal: 20,
  },
  iconButton: {
    fontSize: 18,
    color: '#B80F53',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#BDBDBD',
    fontWeight: '500',
  }
});

export default App;
