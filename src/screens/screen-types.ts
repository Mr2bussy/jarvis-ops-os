import type { OSState, ScreenId } from '../components/os-types';

/** Props shared by full-screen modules (Bridge, Trading, Content, …). */
export interface ScreenProps {
  state: OSState;
  setState: (s: OSState) => void;
  onNav: (id: ScreenId) => void;
  onVoice: () => void;
}
