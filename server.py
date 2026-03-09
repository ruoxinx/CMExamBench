import argparse
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"


class ProxyHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/api/anthropic/messages":
            self._handle_anthropic_proxy()
            return
        self.send_error(404, "Not found")

    def _handle_anthropic_proxy(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        api_key = self.headers.get("x-api-key", "").strip()
        anthropic_version = self.headers.get("anthropic-version", "2023-06-01").strip()

        if not api_key:
            self._send_json(400, {"error": {"message": "Missing x-api-key header"}})
            return

        req = Request(
            ANTHROPIC_MESSAGES_URL,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": anthropic_version,
            },
        )

        try:
            with urlopen(req, timeout=120) as resp:
                response_body = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json"))
                self.send_header("Content-Length", str(len(response_body)))
                self.end_headers()
                self.wfile.write(response_body)
        except HTTPError as e:
            try:
                err_body = e.read()
                parsed = json.loads(err_body.decode("utf-8", errors="replace"))
            except Exception:
                parsed = {"error": {"message": f"Anthropic HTTP {e.code}"}}
            self._send_json(e.code, parsed)
        except URLError as e:
            self._send_json(502, {"error": {"message": f"Network error to Anthropic: {e.reason}"}})
        except Exception as e:
            self._send_json(500, {"error": {"message": f"Proxy error: {str(e)}"}})

    def _send_json(self, status_code, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    parser = argparse.ArgumentParser(description="Static server + Anthropic proxy")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--root",
        default=os.path.abspath(os.path.dirname(__file__)),
        help="Directory to serve static files from",
    )
    args = parser.parse_args()

    os.chdir(args.root)
    server = ThreadingHTTPServer((args.host, args.port), ProxyHandler)
    print(f"Serving {args.root} at http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
