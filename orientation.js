/**
 * DeviceOrientationEvent を使用してスマートフォンの起立状態を検知するクラス
 */
export class OrientationSensor {
  constructor(options = {}) {
    this.options = Object.assign({
      arThreshold: 75,       // ARモードへ移行する角度 (度)
      normalThreshold: 50,   // 通常モードに戻る角度 (度)
      arDelay: 500,          // AR移行に必要な継続時間 (ms)
      normalDelay: 350,      // 通常戻りに必要な継続時間 (ms)
      onModeChange: () => {},// モード切り替えコールバック
      onAngleUpdate: () => {}// 角度更新時のコールバック (デバッグ用)
    }, options);

    this.currentMode = 'NORMAL'; // 'NORMAL' or 'AR'
    this.timer = null;
    this.pendingMode = null;
    this.isSimulating = false; // シミュレーター作動フラグ

    this.handleOrientation = this.handleOrientation.bind(this);
  }

  /**
   * センサー監視の開始
   * ※ブラウザセキュリティのため、ボタン押下などのユーザーアクション契機で呼び出すこと
   */
  async start() {
    if (this.isSimulating) return true;

    if (typeof DeviceOrientationEvent === 'undefined') {
      console.warn('DeviceOrientationEvent is not supported on this device.');
      return false;
    }

    // iOS 13+ での権限要求
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', this.handleOrientation);
          return true;
        } else {
          console.error('DeviceOrientation permission denied.');
          return false;
        }
      } catch (error) {
        console.error('Error requesting DeviceOrientation permission:', error);
        return false;
      }
    } else {
      // Android または iOS 13未満
      window.addEventListener('deviceorientation', this.handleOrientation);
      return true;
    }
  }

  /**
   * センサー監視の停止
   */
  stop() {
    window.removeEventListener('deviceorientation', this.handleOrientation);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 実際のセンサーイベントのハンドリング
   */
  handleOrientation(event) {
    if (this.isSimulating) return; // シミュレーション中は実センサー値を無視

    // beta: デバイスのX軸回りの回転角度（-180度 〜 180度）
    // 画面が正面に向くように垂直に立てると 90 前後になり、水平（見下ろす）に置くと 0 前後になる
    let pitch = event.beta;
    if (pitch === null) return;

    // 絶対値を取って持ち方の差を簡易吸収
    pitch = Math.abs(pitch);
    
    // 角度更新を通知（デバッグ表示用）
    this.options.onAngleUpdate(Math.round(pitch));

    this.evaluateOrientation(pitch);
  }

  /**
   * 傾き角度からモード移行を判定するロジック (ヒステリシス + 遅延判定)
   */
  evaluateOrientation(pitch) {
    let targetMode = this.currentMode;

    // 1. 閾値判定 (ヒステリシスによるチャタリング防止)
    if (pitch >= this.options.arThreshold) {
      targetMode = 'AR';
    } else if (pitch <= this.options.normalThreshold) {
      targetMode = 'NORMAL';
    }

    // 2. モード変化の予兆がある場合、タイマー処理で瞬間的なブレを排除 (Debounce)
    if (targetMode !== this.currentMode) {
      if (this.pendingMode !== targetMode) {
        this.pendingMode = targetMode;
        if (this.timer) clearTimeout(this.timer);

        const delay = (targetMode === 'AR') ? this.options.arDelay : this.options.normalDelay;
        
        this.timer = setTimeout(() => {
          this.currentMode = this.pendingMode;
          this.options.onModeChange(this.currentMode);
          this.timer = null;
        }, delay);
      }
    } else {
      // 元のモードに安定した場合は移行処理をキャンセル
      if (this.timer && this.pendingMode !== this.currentMode) {
        clearTimeout(this.timer);
        this.timer = null;
        this.pendingMode = null;
      }
    }
  }

  /**
   * シミュレーションモードを有効化し、仮想的な角度を適用する (PC開発用)
   */
  simulateAngle(pitch) {
    this.isSimulating = true;
    this.options.onAngleUpdate(pitch);
    this.evaluateOrientation(pitch);
  }

  /**
   * シミュレーションモードの解除
   */
  disableSimulation() {
    this.isSimulating = false;
  }
}
