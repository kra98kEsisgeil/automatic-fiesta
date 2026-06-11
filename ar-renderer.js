import * as THREE from 'three';

/**
 * Three.js を用いてAR案内アセット（矢印・ライン）を描画するクラス
 */
export class ARRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    this.activeObjects = []; // 現在シーンに追加されているオブジェクト群
    this.animationFrameId = null;
    
    this.lineMaterial = null; // 流れるライン用マテリアル
    this.lineOffset = 0;      // ラインのアニメーションオフセット

    this.initThree();
  }

  /**
   * Three.jsの初期化
   */
  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    
    // 暗い背景（通常はカメラ映像が下にあるが、ライトの効果を際立たせるため環境光を設定）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(0, 5, 5);
    this.scene.add(directionalLight);

    // 2. Camera (VPSで姿勢行列を上書きするため matrixAutoUpdate は false に設定)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.matrixAutoUpdate = false; // VPS行列を直接バインドするため自動更新を切る
    this.scene.add(this.camera);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,           // 背景を透過（カメラ映像の上に重ねる）
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // リサイズ監視
    window.addEventListener('resize', () => this.onWindowResize());

    // 4. マテリアル初期化 (流れるネオン効果用)
    this.lineMaterial = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });

    // アニメーションループ開始
    this.animate = this.animate.bind(this);
    this.animate();
  }

  /**
   * 画面リサイズ処理
   */
  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  /**
   * シーンのクリア
   */
  clearScene() {
    this.activeObjects.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }
    });
    this.activeObjects = [];
  }

  /**
   * 指定されたアセット定義群を読み込み、3Dモデルを生成して追加する
   * @param {Array} assets アセット定義オブジェクトの配列
   */
  loadAssets(assets) {
    this.clearScene();
    if (!assets) return;

    assets.forEach(spec => {
      if (spec.type === 'line') {
        this.createGlowingLine(spec);
      } else if (spec.type === 'arrow') {
        this.createFloatingArrow(spec);
      } else if (spec.type === 'highlight') {
        this.createSignHighlight(spec);
      }
    });
  }

  /**
   * 床を這う流動アニメーション付きネオンラインの作成
   */
  createGlowingLine(spec) {
    // 1. 点群データをベクトルに変換
    const points = spec.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    
    // 2. カーブの生成 (CatmullRomCurve3 でなめらかに繋ぐ)
    const curve = new THREE.CatmullRomCurve3(points);
    
    // 3. チューブジオメトリの生成 (太さ 0.08m)
    const geometry = new THREE.TubeGeometry(curve, 64, 0.08, 8, false);
    
    // 4. マテリアル (ネオン調に自発光させるために MeshBasicMaterial に輝度を設定)
    // 頂点のU座標を時間でスライドさせて流れる光をシミュレート
    const material = new THREE.MeshBasicMaterial({
      color: spec.color || 0x3b82f6,
      transparent: true,
      opacity: 0.8,
      wireframe: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { 
      type: 'line', 
      originalColor: spec.color || 0x3b82f6,
      pulseSpeed: 1.5 
    };

    this.scene.add(mesh);
    this.activeObjects.push(mesh);
  }

  /**
   * 空間に浮遊し、上下に揺れる3D矢印の作成
   */
  createFloatingArrow(spec) {
    const group = new THREE.Group();
    group.position.set(spec.position[0], spec.position[1], spec.position[2]);
    group.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);

    // 矢印のコーン（先端）
    const coneGeom = new THREE.ConeGeometry(0.25, 0.5, 16);
    const coneMat = new THREE.MeshPhongMaterial({
      color: 0x60a5fa,
      emissive: 0x1e3a8a,
      specular: 0xffffff,
      shininess: 30
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);

    // 矢印のシリンダー（軸）
    const cylGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 16);
    const cylMat = new THREE.MeshPhongMaterial({
      color: 0x3b82f6,
      emissive: 0x1d4ed8
    });
    const cylinder = new THREE.Mesh(cylGeom, cylMat);

    // 向きに応じた配置調整 (デフォルトは上向きコーン)
    if (spec.direction === 'forward') {
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(0, 0, -0.2);
      cylinder.rotation.x = -Math.PI / 2;
      cylinder.position.set(0, 0, 0.25);
    } else if (spec.direction === 'up') {
      cone.position.y = 0.25;
      cylinder.position.y = -0.15;
    } else if (spec.direction === 'down') {
      cone.rotation.x = Math.PI;
      cone.position.y = -0.25;
      cylinder.position.y = 0.15;
    }

    group.add(cone);
    group.add(cylinder);

    // アニメーション用メタデータ
    group.userData = {
      type: 'arrow',
      startY: spec.position[1],
      hoverSpeed: 3.0,
      hoverHeight: 0.05
    };

    this.scene.add(group);
    this.activeObjects.push(group);
  }

  /**
   * 看板ハイライト枠の作成
   */
  createSignHighlight(spec) {
    // 看板を囲う半透明な赤いガイド枠、または球状のインジケーター
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.5,
      wireframe: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(spec.position[0], spec.position[1], spec.position[2]);

    mesh.userData = {
      type: 'highlight',
      scaleSpeed: 2.0
    };

    this.scene.add(mesh);
    this.activeObjects.push(mesh);
  }

  /**
   * VPSで計算された位置姿勢（変換行列）を Three.js カメラに反映
   * @param {Object} pose VPSManagerから渡されたPoseデータ
   */
  updateCameraPose(pose) {
    if (!pose || !pose.matrix) return;
    
    // elements 配列 (16個の値) から Matrix4 を構築してカメラに適用
    this.camera.matrix.fromArray(pose.matrix);
    
    // 行列の更新を適用（カメラ位置・クォータニオン等の同期）
    this.camera.matrixWorldNeedsUpdate = true;
  }

  /**
   * アニメーションループ
   */
  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    const time = Date.now() * 0.001;

    // シーン上の全オブジェクトのアニメーション処理
    this.activeObjects.forEach(obj => {
      // 1. 矢印の上下浮遊と回転
      if (obj.userData.type === 'arrow') {
        obj.position.y = obj.userData.startY + Math.sin(time * obj.userData.hoverSpeed) * obj.userData.hoverHeight;
        obj.rotation.y += 0.01;
      }
      
      // 2. 進路ラインの光パルスアニメーション
      if (obj.userData.type === 'line') {
        const pulse = 0.6 + Math.sin(time * obj.userData.pulseSpeed) * 0.2;
        obj.material.opacity = pulse;
      }

      // 3. ハイライト枠の脈動アニメーション
      if (obj.userData.type === 'highlight') {
        const scale = 1.0 + Math.sin(time * obj.userData.scaleSpeed) * 0.15;
        obj.scale.set(scale, scale, scale);
      }
    });

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * レンダリングプロセスの全停止
   */
  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.clearScene();
    this.renderer.dispose();
    window.removeEventListener('resize', () => this.onWindowResize());
  }
}
