// Sound utility for auction app
class SoundManager {
  constructor() {
    this.sounds = {
      bid: new Audio('/sounds/bid.mp3'),
      sold: new Audio('/sounds/sold.mp3'),
      notify: new Audio('/sounds/notify.mp3'),
      start: new Audio('/sounds/start.mp3'),
    };

    // Preload all sounds
    Object.values(this.sounds).forEach(sound => {
      sound.preload = 'auto';
      sound.volume = 0.5;
    });
  }

  play(soundName) {
    try {
      const sound = this.sounds[soundName];
      if (sound) {
        sound.currentTime = 0;
        sound.play().catch(err => console.log('Sound play failed:', err));
      }
    } catch (err) {
      console.log('Sound error:', err);
    }
  }

  setVolume(volume) {
    Object.values(this.sounds).forEach(sound => {
      sound.volume = Math.max(0, Math.min(1, volume));
    });
  }
}

export const soundManager = new SoundManager();
