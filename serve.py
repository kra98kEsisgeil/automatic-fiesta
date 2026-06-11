import http.server
import ssl
import os
import socket

PORT_HTTP = 8000
PORT_HTTPS = 8443

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # 接続先は実際には接続しません
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # WebARの動作に必要なヘッダーを設定
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

def run_server():
    ip = get_local_ip()
    cert_exists = os.path.exists('cert.pem') and os.path.exists('key.pem')
    
    if cert_exists:
        # HTTPS サーバーの起動
        server_address = ('0.0.0.0', PORT_HTTPS)
        httpd = http.server.HTTPServer(server_address, MyHTTPRequestHandler)
        
        # SSLの適用 (Python 3.10+ に対応した形)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        
        print("\n" + "="*60)
        print(f"🔒 HTTPS 開発サーバーを起動しました (ポート {PORT_HTTPS})")
        print(f"PCでテストする場合:  https://localhost:{PORT_HTTPS}/")
        print(f"スマホでテストする場合: https://{ip}:{PORT_HTTPS}/")
        print("="*60 + "\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nサーバーを停止しました。")
    else:
        # HTTP サーバーの起動 (フォールバック)
        server_address = ('0.0.0.0', PORT_HTTP)
        httpd = http.server.HTTPServer(server_address, MyHTTPRequestHandler)
        
        print("\n" + "="*60)
        print(f"🔓 HTTP 開発サーバーを起動しました (ポート {PORT_HTTP})")
        print(f"PCでテストする場合:  http://localhost:{PORT_HTTP}/")
        print(f"スマホでテストする場合: http://{ip}:{PORT_HTTP}/")
        print("\n💡 【注意】スマホのカメラやジャイロセンサーを使用するには、HTTPSが必須です。")
        print("実機でテストする場合は、以下のいずれかの方法を行ってください：")
        print("1. 自己署名証明書 (key.pem と cert.pem) を本フォルダに作成する：")
        print("   openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem")
        print("2. スマホのChromeデバッグ設定で、このアドレスを「安全なオリジン」として扱う：")
        print(f"   chrome://flags/#unsafely-treat-insecure-origin-as-secure を開き、")
        print(f"   'http://{ip}:{PORT_HTTP}' を追加して有効化し、Chromeを再起動する。")
        print("="*60 + "\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nサーバーを停止しました。")

if __name__ == '__main__':
    run_server()
