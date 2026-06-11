/**
 * Immersal Web SDK の初期化・VPS照合・ローカライズ処理を管理するクラス
 */
export class VPSManager {
  constructor(options = {}) {
    this.options = Object.assign({
      developerToken: "",          // Immersal Developer Portalで取得したトークン
      onStatusChange: () => {},    // ステータス変更時のコールバック ('searching', 'success', 'fail')
      onPoseUpdate: () => {}       // 位置姿勢（Pose）更新時のコールバック
    }, options);

    this.status = 'searching';     // 'searching', 'success', 'fail'
    this.isLocalizing = false;
    this.localizeInterval = null;
    this.isSimulated = true;       // プロトタイプでは初期値をシミュレーション有効とする
    this.mockMatrix = null;
  }

  /**
   * VPSマネージャーの初期化
   */
  async init(token) {
    this.options.developerToken = token || this.options.developerToken;
    console.log("VPSManager: Initialized with token: ", this.options.developerToken ? "Provided" : "None");
    
    // Immersal Web SDK のライブラリがグローバル/CDNで読み込まれていれば初期化処理を行う
    // 実機連携時は window.Immersal などのSDK実体を利用するが、PoCではシミュレータ優先
    return true;
  }

  /**
   * VPSローカライズ処理の開始
   * @param {HTMLVideoElement} videoElement カメラ映像ソース
   */
  startLocalizing(videoElement) {
    if (this.isLocalizing) return;
    this.isLocalizing = true;
    this.updateStatus('searching');

    console.log("VPSManager: Started localization monitoring.");

    if (this.isSimulated) {
      // シミュレーションモード：3秒ごとにダミーPose更新を投げる
      this.localizeInterval = setInterval(() => {
        if (this.status === 'success') {
          // すでに成功している場合は、微細な位置ノイズをのせてカメラトラッキングを更新
          const mockPose = this.generateMockPose();
          this.options.onPoseUpdate(mockPose);
        }
      }, 100);
    } else {
      // ─── 実機 VPS 接続実装イメージ ───
      // 1. ビデオの各フレームから Canvas に画像を切り出す
      // 2. Immersal SDK の `localize(imageBytes)` をコールしてクラウドと照合
      // 3. マッチングに成功すれば、返却された位置姿勢行列 (4x4 Matrix) を onPoseUpdate に渡す
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      this.localizeInterval = setInterval(async () => {
        if (!videoElement.videoWidth) return;
        
        canvas.width = videoElement.videoWidth / 2; // パフォーマンスのため縮小
        canvas.height = videoElement.videoHeight / 2;
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        try {
          // ダミーのクラウドAPI通信 (実機テスト時に書き換え)
          // const response = await fetch('https://api.immersal.com/localize', { ... });
          // const result = await response.json();
          // if (result.success) { this.updateStatus('success'); this.options.onPoseUpdate(result.pose); }
        } catch (e) {
          console.error("VPS Localization Error: ", e);
        }
      }, 1000); // 1秒おきに照合
    }
  }

  /**
   * VPSローカライズ処理の停止
   */
  stopLocalizing() {
    this.isLocalizing = false;
    if (this.localizeInterval) {
      clearInterval(this.localizeInterval);
      this.localizeInterval = null;
    }
    console.log("VPSManager: Stopped localization monitoring.");
  }

  /**
   * ステータスの更新と通知
   */
  updateStatus(newStatus) {
    this.status = newStatus;
    this.options.onStatusChange(newStatus);
  }

  /**
   * デバッグ用：照合成功状態を強制シミュレートする
   */
  simulateSuccess() {
    this.isSimulated = true;
    this.updateStatus('success');
    // 初回の確定Poseを通知
    const initPose = this.generateMockPose();
    this.options.onPoseUpdate(initPose);
    console.log("VPSManager: Simulated localization success.");
  }

  /**
   * デバッグ用：未照合（検索中）状態にする
   */
  simulateFail() {
    this.isSimulated = true;
    this.updateStatus('searching');
    console.log("VPSManager: Simulated localization searching state.");
  }

  /**
   * 擬似的なカメラの位置姿勢（Pose）を生成
   * 現地で位置合わせがピタッと決まり、3Dアセットが正しい位置に描画されるような姿勢行列を構築
   */
  generateMockPose() {
    // デバイス位置 (X, Y, Z) と向き (クォータニオン/行列)
    // Three.js のカメラに直接適応できる形式 (4x4 変換行列の配列) を擬似的に返却
    const time = Date.now() * 0.001;
    // ユーザーがスマホを構えて立っており、手の揺れで少しだけブレる状態を再現
    const swayX = Math.sin(time * 2.0) * 0.02;
    const swayY = Math.cos(time * 1.5) * 0.01;
    
    // Unity/Immersal 空間から Three.js 空間への適応行列
    // ここでは単純化した位置・回転の変換オブジェクトをモックとして返します
    return {
      position: { x: swayX, y: -0.5 + swayY, z: 0.1 },
      rotation: { x: 0, y: 0, z: 0 },
      matrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        swayX, -0.5 + swayY, 0.1, 1
      ]
    };
  }
}
