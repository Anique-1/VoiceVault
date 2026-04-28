import { NativeModules } from 'react-native';

type Recording = {
  name: string;
  path: string;
  size: number;
};

interface CallRecorderModuleInterface {
  toggleService(enable: boolean): Promise<void>;
  getServiceState(): Promise<boolean>;
  getRecordings(): Promise<Recording[]>;
  playRecording(path: string): Promise<void>;
  stopPlaying(): Promise<void>;
  pausePlaying(): Promise<void>;
  resumePlaying(): Promise<void>;
  getPlaybackInfo(): Promise<{position: number, duration: number, isPlaying: boolean} | null>;
  deleteRecording(path: string): Promise<void>;
}

const { CallRecorderModule } = NativeModules;

export default CallRecorderModule as CallRecorderModuleInterface;
