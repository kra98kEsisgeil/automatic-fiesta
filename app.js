import { RouteManager } from './router.js';
import { OrientationSensor } from './orientation.js';
import { VPSManager } from './vps-manager.js';
import { ARRenderer } from './ar-renderer.js';

// ==================== APP STATE ====================
let routeManager = new RouteManager();
let orientationSensor = null;
let vpsManager = null;
let arRenderer = null;

let currentRoute = null;
let currentStepIndex = 0; // 0-indexed
let currentMode = 'SETUP'; // 'SETUP', 'NORMAL', 'AR'
let cameraStream = null;

// ==================== DOM ELEMENTS ====================
const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const normalViewport = document.getElementById('normal-viewport');
const arViewport = document.getElementById('ar-viewport');
const cameraVideo = document.getElementById('camera-stream');
const arCanvas = document.getElementById('ar-canvas');
const loader = document.getElementById('global-loader');
const loaderText = document.getElementById('loader-text');

// Forms & Buttons
const startPointSelect = document.getElementById('start-point');
const endPointSelect = document.getElementById('end-point');
const startBtn = document.getElementById('start-btn');
const exitNavBtn = document.getElementById('exit-nav-btn');
const arCloseBtn = document.getElementById('ar-close-btn');

// UI Content Fields
const normalRouteName = document.getElementById('normal-route-name');
const normalStepIcon = document.getElementById('normal-step-icon');
const normalStepDistance = document.getElementById('normal-step-distance');
const normalStepText = document.getElementById('normal-step-text');
const normalStepSub = document.getElementById('normal-step-sub');

const arStepIcon = document.getElementById('ar-step-icon');
const arStepTitle = document.getElementById('ar-step-title');
const arStepDesc = document.getElementById('ar-step-desc');
const vpsStatusBadge = document.getElementById('vps-status-badge');
const vpsStatusText = vpsStatusBadge.querySelector('.status-text');

// Alert
const turnAlertBanner = document.getElementById('turn-alert-banner');

// Debug Panel Elements
const debugPanel = document.getElementById('debug-panel');
const openDebugBtn = document.getElementById('open-debug-btn');
const toggleDebugBtn = document.getElementById('toggle-debug-btn');
const simTiltDown = document.getElementById('sim-tilt-down');
const simTiltUp = document.getElementById('sim-tilt-up');
const simVpsFail = document.getElementById('sim-vps-fail');
const simVpsSuccess = document.getElementById('sim-vps-success');
const simStep1 = document.getElementById('sim-step-1');
const simStep2 = document.getElementById('sim-step-2');
const simStep3 = document.getElementById('sim-step-3');
const debugAngleVal = document.getElementById('debug-angle-val');
const debugStateVal = document.getElementById('debug-state-val');

// ==================== INITIALIZATION ====================
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // 1. 各クラスの初期化
  orientationSensor = new OrientationSensor({
    onModeChange: (mode) => handleModeChange(mode),
    onAngleUpdate: (angle) => {
      debugAngleVal.textContent = angle;
    }
  });

  vpsManager = new VPSManager({
    onStatusChange: (status) => handleVpsStatusChange(status),
    onPoseUpdate: (pose) => {
      if (arRenderer && currentMode === 'AR') {
        arRenderer.updateCameraPose(pose);
      }
    }
  });

  // 2. イベントリスナー登録
  startBtn.addEventListener('click', startNavigation);
  exitNavBtn.addEventListener('click', stopNavigation);
  arCloseBtn.addEventListener('click', () => {
    // 手動でARを閉じる場合は、一時的にシミュレータ等の角度を下げて通常モードへ戻す
    orientationSensor.simulateAngle(15);
    updateDebugButtons();
  });

  // デバッグUI制御
  openDebugBtn.addEventListener('click', () => debugPanel.classList.add('active'));
  toggleDebugBtn.addEventListener('click', () => debugPanel.classList.remove('active'));

  simTiltDown.addEventListener('click', () => {
    orientationSensor.simulateAngle(15);
    updateDebugButtons();
  });
  simTiltUp.addEventListener('click', () => {
    orientationSensor.simulateAngle(85);
    updateDebugButtons();
  });
  simVpsFail.addEventListener('click', () => {
    vpsManager.simulateFail();
    updateDebugButtons();
  });
  simVpsSuccess.addEventListener('click', () => {
    vpsManager.simulateSuccess();
    updateDebugButtons();
  });
  
  const stepButtons = [simStep1, simStep2, simStep3];
  stepButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      jumpToStep(idx);
      updateDebugButtons();
    });
  });
}

// ==================== CORE ACTIONS ====================

/**
 * ナビゲーションの開始
 */
async function startNavigation() {
  showLoader('センサーとカメラの準備中...');

  const startPt = startPointSelect.value;
  const endPt = endPointSelect.value;
  currentRoute = routeManager.getRoute(startPt, endPt);
  currentStepIndex = 0;

  // UI初期テキストの設定
  normalRouteName.textContent = currentRoute.name;

  try {
    // B. ジャイロセンサーの開始を最優先（iOSのクリックコンテキスト維持のため）
    const sensorStarted = await orientationSensor.start();
    if (!sensorStarted) {
      alert("ジャイロセンサーの開始に失敗しました。シミュレーションモードで動作します。");
    }

    // A. カメラ映像（メディアストリーム）の取得
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    cameraVideo.srcObject = cameraStream;
    // メタデータロード後に再生開始
    cameraVideo.onloadedmetadata = () => {
      cameraVideo.play();
    };

    // C. Three.js ARレンダラーの初期化
    if (!arRenderer) {
      arRenderer = new ARRenderer(arCanvas);
    }

    // D. VPSマネージャーの初期化 (開発トークン等)
    await vpsManager.init("immersal_poc_token_2026");

    // E. 画面遷移
    setupScreen.classList.remove('active');
    appScreen.classList.add('active');
    
    // 初期状態は「通常モード」
    currentMode = 'NORMAL';
    debugStateVal.textContent = 'NORMAL';
    
    // 通常画面にデータを反映
    updateStepUI();

    // 初回のVPSローカライズは未照合（スマホを下ろしているため）
    vpsManager.simulateFail();

    hideLoader();

    // デバッグ用にデフォルトで傾きを通常(水平)にする
    orientationSensor.simulateAngle(15);
    updateDebugButtons();

  } catch (error) {
    console.error("Navigation Init Failed:", error);
    hideLoader();
    alert("カメラまたはセンサーの起動に失敗しました。カメラパーミッションをご確認ください。\n(ローカルホストまたはHTTPS環境が必要です)");
  }
}

/**
 * ナビゲーションの終了
 */
function stopNavigation() {
  showLoader('ナビゲーションを終了中...');

  // 1. センサーの停止
  if (orientationSensor) {
    orientationSensor.stop();
    orientationSensor.disableSimulation();
  }

  // 2. VPSの停止
  if (vpsManager) {
    vpsManager.stopLocalizing();
  }

  // 3. カメラストリームの停止
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;

  // 4. ARレンダラーのクリア
  if (arRenderer) {
    arRenderer.clearScene();
  }

  // 5. アラートクリア
  turnAlertBanner.classList.remove('active');

  // 6. 画面遷移
  appScreen.classList.remove('active');
  setupScreen.classList.add('active');
  currentMode = 'SETUP';

  hideLoader();
}

// ==================== STATE TRANSITIONS ====================

/**
 * 通常モードとARモードのシームレスな切り替え
 */
function handleModeChange(newMode) {
  if (currentMode === 'SETUP') return;
  if (currentMode === newMode) return;

  console.log(`Mode Transition: ${currentMode} ➔ ${newMode}`);
  currentMode = newMode;
  debugStateVal.textContent = newMode;

  if (newMode === 'AR') {
    // ─── ARモード起動 ───
    // A. カメラ映像のアクティブ化
    if (cameraStream) {
      cameraStream.getVideoTracks().forEach(track => track.enabled = true);
    }
    
    // B. UI切り替え (フェード効果はCSSで制御)
    normalViewport.classList.remove('active');
    
    // C. VPSトラッキングおよびローカライズの開始
    vpsManager.startLocalizing(cameraVideo);
    
    // D. ARアセットのロード
    const stepData = currentRoute.steps[currentStepIndex];
    if (arRenderer && stepData) {
      arRenderer.loadAssets(stepData.arAssets);
    }

  } else {
    // ─── 通常モード（歩行安全）復帰 ───
    // A. UI切り替え
    normalViewport.classList.add('active');

    // B. VPSトラッキングのポーズ
    vpsManager.stopLocalizing();
    
    // C. カメラストリームのポーズ（バッテリー節約、enabled = falseでカメラライトを消す）
    if (cameraStream) {
      cameraStream.getVideoTracks().forEach(track => track.enabled = false);
    }

    // AR空間オブジェクトのクリア
    if (arRenderer) {
      arRenderer.clearScene();
    }
  }
}

/**
 * VPSの位置照合ステータス変化時のUI演出
 */
function handleVpsStatusChange(status) {
  vpsStatusBadge.className = 'status-badge'; // classリセット
  
  if (status === 'searching') {
    vpsStatusBadge.classList.add('state-searching');
    vpsStatusText.textContent = 'VPS照合中...';
  } else if (status === 'success') {
    vpsStatusBadge.classList.add('state-success');
    vpsStatusText.textContent = 'VPS位置特定成功';
    
    // 振動フィードバック (VPS合致時の手応え)
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  } else {
    vpsStatusBadge.classList.add('state-fail');
    vpsStatusText.textContent = '位置照合ロスト';
  }
}

/**
 * ステップ情報のUI更新（通常モードおよびARモードのHUD）
 */
function updateStepUI() {
  if (!currentRoute || !currentRoute.steps[currentStepIndex]) return;
  const step = currentRoute.steps[currentStepIndex];

  // 1. 通常モードUIの更新
  normalStepDistance.textContent = step.distance;
  normalStepText.textContent = step.text;
  normalStepSub.textContent = step.subtext;

  // アイコンのマテリアルアイコンキーマッピング
  let iconName = 'straight';
  if (step.icon === 'straight') iconName = 'arrow_upward';
  else if (step.icon === 'stairs') iconName = 'stairs';
  else if (step.icon === 'escalator') iconName = 'open_in_full'; // エスカレーターダミー
  normalStepIcon.textContent = iconName;

  // 2. ARモードHUDの更新
  arStepTitle.textContent = step.arTitle;
  arStepDesc.textContent = step.arDesc;
  
  let arIcon = 'arrow_upward';
  if (step.arStepIcon === 'arrow_upward') arIcon = 'arrow_upward';
  else if (step.arStepIcon === 'stairs') arIcon = 'stairs';
  else if (step.arStepIcon === 'arrow_downward') arIcon = 'arrow_downward';
  arStepIcon.textContent = arIcon;

  // 3. 次の分岐点への接近警告 (ステップ2, 3などの手前で演出)
  // 2Dナビ画面で、「そろそろスマホを立てる分岐点」であることを示すアラートを表示
  // 実運用ではPDRによる残距離連動で行うが、PoCではステップに紐付けてシミュレート
  if (currentStepIndex > 0) {
    turnAlertBanner.classList.add('active');
    // スマホのバイブレーションをシミュレート
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  } else {
    turnAlertBanner.classList.remove('active');
  }
}

/**
 * 特定のステップにジャンプする (シミュレーター連動用)
 */
function jumpToStep(index) {
  if (!currentRoute || index < 0 || index >= currentRoute.steps.length) return;
  
  currentStepIndex = index;
  updateStepUI();

  // ARモードが有効な場合は、アセットもそのステップのものにリロードする
  if (currentMode === 'AR' && arRenderer) {
    const step = currentRoute.steps[currentStepIndex];
    arRenderer.loadAssets(step.arAssets);
  }
}

// ==================== UI UTILITIES ====================
function showLoader(text) {
  loaderText.textContent = text || 'ロード中...';
  loader.classList.add('active');
}

function hideLoader() {
  loader.classList.remove('active');
}

/**
 * シミュレータのトグルボタンのアクティブクラスの同期
 */
function updateDebugButtons() {
  // 1. 傾き
  if (orientationSensor.currentMode === 'AR') {
    simTiltDown.classList.remove('active');
    simTiltUp.classList.add('active');
  } else {
    simTiltDown.classList.add('active');
    simTiltUp.classList.remove('active');
  }

  // 2. VPS
  if (vpsManager.status === 'success') {
    simVpsFail.classList.remove('active');
    simVpsSuccess.classList.add('active');
  } else {
    simVpsFail.classList.add('active');
    simVpsSuccess.classList.remove('active');
  }

  // 3. ステップ
  const stepButtons = [simStep1, simStep2, simStep3];
  stepButtons.forEach((btn, idx) => {
    if (currentStepIndex === idx) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}
