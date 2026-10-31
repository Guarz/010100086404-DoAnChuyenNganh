# File: colab/auth_proxy.py
# Proxy nhỏ đứng trước Ollama: chỉ cho request có header "Authorization: Bearer <TOKEN>" đi qua.
# Lý do: Ollama gốc không có xác thực, còn tunnel Cloudflare tạo ra URL công khai trên Internet.
# Chỉ dùng thư viện chuẩn Python (Colab có sẵn). Notebook colab/ollama_dolphin_colab.ipynb nạp file này.
import http.server
import threading
import urllib.error
import urllib.request

OLLAMA_UPSTREAM = 'http://127.0.0.1:11434'


def start_auth_proxy(token, port=8000, upstream=OLLAMA_UPSTREAM):
    class Proxy(http.server.BaseHTTPRequestHandler):
        def _reply(self, status, body=b'', content_type='application/json'):
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _forward(self):
            if self.headers.get('Authorization') != f'Bearer {token}':
                return self._reply(401, b'{"error":"unauthorized"}')
            # Chỉ mở API cần thiết, không mở các API quản trị (pull/delete/create model...)
            if self.path not in ('/api/chat', '/api/generate', '/api/tags'):
                return self._reply(404, b'{"error":"not found"}')

            length = int(self.headers.get('Content-Length') or 0)
            body = self.rfile.read(length) if length else None
            request = urllib.request.Request(
                upstream + self.path, data=body, method=self.command,
                headers={'Content-Type': 'application/json'}
            )
            try:
                with urllib.request.urlopen(request, timeout=300) as res:
                    return self._reply(res.status, res.read())
            except urllib.error.HTTPError as error:
                return self._reply(error.code, error.read())
            except Exception as error:  # Ollama chưa chạy, quá thời gian...
                return self._reply(502, f'{{"error":"{type(error).__name__}"}}'.encode())

        do_GET = _forward
        do_POST = _forward

        def log_message(self, *args):  # tắt log mỗi request cho gọn output Colab
            pass

    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Proxy)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server
