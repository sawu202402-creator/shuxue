#!/usr/bin/env python3
"""
dev_server.py - 带有配置写入 API 的开发热重载服务器
支持静态文件托管以及直接接收浏览器端可视化地图编辑器的保存请求，并自动持久化写入 js/map.js
"""

import http.server
import json
import os
import sys

PORT = 8080
MAP_JS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'js', 'map.js')
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
PROFILES_FILE = os.path.join(DATA_DIR, 'user_profiles.json')
RECORDS_FILE = os.path.join(DATA_DIR, 'game_records.json')

class DevHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 增加跨域与无缓存头，避免开发期缓存影响
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/get_profiles':
            try:
                data = None
                if os.path.exists(PROFILES_FILE):
                    with open(PROFILES_FILE, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                
                resp = {"success": True, "data": data}
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(resp, ensure_ascii=False).encode('utf-8'))
                return
            except Exception as e:
                print(f"[API 错误] 获取小朋友档案失败: {e}")
                err_resp = {"success": False, "error": str(e)}
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(err_resp, ensure_ascii=False).encode('utf-8'))
                return

        if self.path.startswith('/api/get_game_records'):
            try:
                records = []
                if os.path.exists(RECORDS_FILE):
                    with open(RECORDS_FILE, 'r', encoding='utf-8') as f:
                        records = json.load(f)
                
                resp = {"success": True, "records": records}
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(resp, ensure_ascii=False).encode('utf-8'))
                return
            except Exception as e:
                print(f"[API 错误] 获取战报记录失败: {e}")
                err_resp = {"success": False, "error": str(e)}
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(err_resp, ensure_ascii=False).encode('utf-8'))
                return

        super().do_GET()

    def do_POST(self):
        if self.path == '/api/record_game':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                record = json.loads(post_data.decode('utf-8'))
                os.makedirs(DATA_DIR, exist_ok=True)
                
                # 1. 追加到 game_records.json
                all_records = []
                if os.path.exists(RECORDS_FILE):
                    try:
                        with open(RECORDS_FILE, 'r', encoding='utf-8') as f:
                            all_records = json.load(f)
                    except Exception:
                        all_records = []
                all_records.insert(0, record)
                # 限制最多保留 300 条全局记录
                if len(all_records) > 300:
                    all_records = all_records[:300]
                with open(RECORDS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(all_records, f, indent=2, ensure_ascii=False)
                
                # 2. 同步更新对应小朋友档案中的 history
                user_id = record.get('userId')
                if user_id and os.path.exists(PROFILES_FILE):
                    try:
                        with open(PROFILES_FILE, 'r', encoding='utf-8') as f:
                            profiles = json.load(f)
                        users = profiles.get('users', [])
                        for u in users:
                            if u.get('id') == user_id:
                                if 'history' not in u:
                                    u['history'] = []
                                u['history'].insert(0, record)
                                if len(u['history']) > 50:
                                    u['history'] = u['history'][:50]
                                break
                        with open(PROFILES_FILE, 'w', encoding='utf-8') as f:
                            json.dump(profiles, f, indent=4, ensure_ascii=False)
                    except Exception as e_sync:
                        print(f"[API 警告] 同步至小朋友档案失败: {e_sync}")

                print(f"[API] 成功记录小朋友【{record.get('userName')}】第 {record.get('levelId')} 关战报！(答题: {record.get('stats', {}).get('totalAttempted')} 题, 正确率: {record.get('stats', {}).get('accuracy')}%)")
                resp = {"success": True, "message": "战报已记录"}
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(resp, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                print(f"[API 错误] 记录战报失败: {e}")
                err_resp = {"success": False, "error": str(e)}
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(err_resp, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/save_profiles':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                os.makedirs(DATA_DIR, exist_ok=True)
                with open(PROFILES_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4, ensure_ascii=False)
                
                num_users = len(data.get('users', [])) if isinstance(data, dict) else 0
                print(f"[API] 成功持久化保存小朋友档案到 data/user_profiles.json！(共 {num_users} 位小朋友)")
                resp = {"success": True, "message": "小朋友档案已成功保存至服务端 data/user_profiles.json！"}
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(resp, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                print(f"[API 错误] 保存小朋友档案失败: {e}")
                err_resp = {"success": False, "error": str(e)}
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(err_resp, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/save_level':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                level_id = str(data.get('levelId'))
                new_config = data.get('config')

                if not level_id or not new_config:
                    raise ValueError("缺少 levelId 或 config 参数")

                # 读取并更新 js/map.js
                with open(MAP_JS_PATH, 'r', encoding='utf-8') as f:
                    content = f.read()

                start_marker = 'export const LEVEL_CONFIGS = '
                end_marker = ';\n\nexport class GameMap {'
                s_idx = content.find(start_marker)
                e_idx = content.find(end_marker)

                if s_idx == -1 or e_idx == -1:
                    # 备选匹配换行格式
                    end_marker = ';\nexport class GameMap {'
                    e_idx = content.find(end_marker)

                if s_idx == -1 or e_idx == -1:
                    raise ValueError("在 js/map.js 中未能匹配到 LEVEL_CONFIGS 声明块")

                json_str = content[s_idx + len(start_marker):e_idx]
                configs = json.loads(json_str)

                # 强制校验关卡真实 ID，防止误把别关的配置写错编号
                cfg_id = new_config.get('id')
                if cfg_id:
                    level_id = str(cfg_id)
                new_config['id'] = int(level_id)

                # 更新指定关卡
                configs[level_id] = new_config

                # 重新序列化并写入
                new_json_str = json.dumps(configs, indent=4, ensure_ascii=False)
                new_content = content[:s_idx + len(start_marker)] + new_json_str + content[e_idx:]

                with open(MAP_JS_PATH, 'w', encoding='utf-8') as f:
                    f.write(new_content)

                print(f"[API] 成功持久化保存第 {level_id} 关配置到 js/map.js！")

                response = {
                    "success": True,
                    "levelId": level_id,
                    "message": f"第 {level_id} 关【{new_config.get('name', '')}】配置已成功写入本地项目代码 (js/map.js)！"
                }
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

            except Exception as e:
                print(f"[API 错误] 保存关卡配置失败: {e}")
                err_resp = {"success": False, "error": str(e)}
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(err_resp, ensure_ascii=False).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), DevHandler)
    print(f"🚀 开发服务器已启动，监听端口: {PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器正在关闭...")
        server.server_close()
