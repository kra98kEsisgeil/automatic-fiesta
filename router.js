/**
 * ルート定義とロード管理を行うクラス
 */
export class RouteManager {
  constructor() {
    // 静的ルート定義データベース
    this.routes = {
      "jr_south_gate_to_toei_shinjuku_gate": {
        name: "JR南改札 ➔ 都営新宿線",
        mapId: "12345_shinjuku_south", // Immersal Map ID
        steps: [
          {
            id: 1,
            distance: 50,
            text: "まっすぐ奥へ進む",
            subtext: "小田急線改札等のノイズを無視し、奥の突き当たりに向かって通路を直進します",
            icon: "straight",
            arTitle: "光の進路ラインに沿って直進",
            arDesc: "小田急線改札は無視して、通路の突き当たりまで直進してください",
            arStepIcon: "arrow_upward",
            // AR空間上の3Dオブジェクト定義
            arAssets: [
              {
                id: "line_1",
                type: "line",
                color: 0x3b82f6, // 青い光のライン
                // Three.js 座標系でのラインの制御点 [x, y, z]
                points: [
                  [0, -1.2, 0],
                  [0, -1.2, -15],
                  [1.5, -1.2, -30],
                  [1.5, -1.2, -45]
                ]
              },
              {
                id: "arrow_start",
                type: "arrow",
                direction: "forward",
                position: [0, -0.5, -8],
                rotation: [0, 0, 0]
              }
            ]
          },
          {
            id: 2,
            distance: 15,
            text: "突き当たりを右へ進み、階段を上がる",
            subtext: "突き当たりを右折すると短い階段があります。上向きの矢印に従ってください",
            icon: "stairs",
            arTitle: "突き当たりを右折して階段へ",
            arDesc: "階段の手前に「上向きの3D矢印」を表示しています。階段を上がってください",
            arStepIcon: "stairs",
            arAssets: [
              {
                id: "line_2",
                type: "line",
                color: 0x8b5cf6, // 紫の光ライン
                points: [
                  [1.5, -1.2, -45],
                  [5, -1.2, -47],
                  [8, 1.5, -48] // 階段を上るようにY座標を上げる
                ]
              },
              {
                id: "arrow_up",
                type: "arrow",
                direction: "up", // 上向きの3D矢印
                position: [5, -0.2, -47],
                rotation: [0, -Math.PI / 2, 0]
              }
            ]
          },
          {
            id: 3,
            distance: 30,
            text: "エスカレーターで地下へ下りる",
            subtext: "都営新宿線方面の看板がある長いエスカレーターを、2回続けて下ります",
            icon: "escalator",
            arTitle: "エスカレーターで都営新宿線改札へ",
            arDesc: "都営新宿線方面の看板をハイライトしています。下向きの3D矢印の先へ進みます",
            arStepIcon: "arrow_downward",
            arAssets: [
              {
                id: "line_3",
                type: "line",
                color: 0x10b981, // 緑の光ライン
                points: [
                  [8, 1.5, -48],
                  [12, 1.5, -48],
                  [18, -4.5, -48] // 地下へ下りる
                ]
              },
              {
                id: "arrow_down",
                type: "arrow",
                direction: "down",
                position: [12, 2.0, -48],
                rotation: [0, -Math.PI / 2, 0]
              },
              {
                id: "highlight_sign",
                type: "highlight",
                position: [18, -1.5, -48],
                label: "都営新宿線"
              }
            ]
          }
        ]
      }
      // 将来的に他のルートをここに追加可能
    };
  }

  /**
   * 出発地・目的地に対応するルートを検索して取得する
   */
  getRoute(startId, endId) {
    // プロトタイプでは1つの主要ルートのみ本番データとし、他はダミーで動かす
    const key = `${startId}_to_${endId}`;
    if (this.routes[key]) {
      return this.routes[key];
    }
    
    // 見つからない場合は新宿南改札のルートを返す（PoC仕様のフォールバック）
    console.warn(`Route "${key}" not found. Falling back to Shinjuku South route.`);
    return this.routes["jr_south_gate_to_toei_shinjuku_gate"];
  }
}
