#!/usr/bin/env python3
import os
import json
import time
from datetime import datetime, timedelta
from pathlib import Path

# 日志目录
LOG_DIR = Path(__file__).parent / 'security-logs'
LOG_DIR.mkdir(exist_ok=True)

class SecurityMonitor:
    def __init__(self):
        self.alerts = []
        self.processed_files = set()
        self.user_actions = {}
        self.admin_actions = {}
        self.last_check = datetime.now()

    def parse_log_file(self, file_path):
        """解析日志文件"""
        actions = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        log_entry = json.loads(line)
                        actions.append(log_entry)
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
        return actions

    def check_security_alerts(self, actions):
        """检查安全告警"""
        alerts = []
        now = datetime.now()

        for action in actions:
            entry_time = datetime.fromisoformat(action['timestamp'].replace('Z', '+00:00'))
            
            # 检查是否是最近10分钟内的日志
            if (now - entry_time).total_seconds() > 600:
                continue

            if action['type'] == 'RATE_LIMIT_EXCEEDED':
                alerts.append({
                    'level': 'WARNING',
                    'message': f"速率限制触发: IP {action['data'].get('ip', 'unknown')} 请求次数过多",
                    'timestamp': action['timestamp']
                })
            elif action['type'] == 'SQL_INJECTION_ATTEMPT':
                alerts.append({
                    'level': 'CRITICAL',
                    'message': f"SQL注入尝试: IP {action['data'].get('ip', 'unknown')}",
                    'timestamp': action['timestamp']
                })
            elif action['type'] == 'MASS_REGISTRATION_ATTACK':
                alerts.append({
                    'level': 'CRITICAL',
                    'message': f"大量注册攻击检测: IP {action['data'].get('ip', 'unknown')}",
                    'timestamp': action['timestamp']
                })
            elif action['type'] == 'LOGIN_THRESHOLD_EXCEEDED':
                alerts.append({
                    'level': 'WARNING',
                    'message': f"登录失败次数超限: IP {action['data'].get('ip', 'unknown')}",
                    'timestamp': action['timestamp']
                })

        return alerts

    def track_user_activity(self, actions):
        """跟踪用户活动"""
        for action in actions:
            if action['type'] == 'USER_ACTION':
                user_id = action['data'].get('userId')
                if user_id not in self.user_actions:
                    self.user_actions[user_id] = []
                self.user_actions[user_id].append(action)
            elif action['type'] == 'ADMIN_ACTION':
                admin_id = action['data'].get('adminId')
                if admin_id not in self.admin_actions:
                    self.admin_actions[admin_id] = []
                self.admin_actions[admin_id].append(action)

    def generate_report(self):
        """生成监控报告"""
        report = {
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_user_actions': sum(len(acts) for acts in self.user_actions.values()),
                'total_admin_actions': sum(len(acts) for acts in self.admin_actions.values()),
                'active_users': len(self.user_actions),
                'active_admins': len(self.admin_actions)
            },
            'recent_alerts': self.alerts[-50:],
            'user_activity_summary': [
                {
                    'user_id': user_id,
                    'action_count': len(acts),
                    'last_action': acts[-1]['timestamp'] if acts else None
                }
                for user_id, acts in self.user_actions.items()
            ],
            'admin_activity_summary': [
                {
                    'admin_id': admin_id,
                    'action_count': len(acts),
                    'last_action': acts[-1]['timestamp'] if acts else None
                }
                for admin_id, acts in self.admin_actions.items()
            ]
        }
        return report

    def run(self):
        """运行监控"""
        print(f"[安全监控] 开始运行 - {datetime.now().isoformat()}")
        
        while True:
            try:
                # 获取今天的日志文件
                today = datetime.now()
                log_file = LOG_DIR / f"security-{today.year}-{today.month:02d}-{today.day:02d}.log"
                
                if log_file.exists() and str(log_file) not in self.processed_files:
                    print(f"[监控] 处理新日志文件: {log_file}")
                    actions = self.parse_log_file(log_file)
                    
                    # 检查告警
                    new_alerts = self.check_security_alerts(actions)
                    self.alerts.extend(new_alerts)
                    
                    # 记录到控制台
                    for alert in new_alerts:
                        print(f"[{alert['level']}] {alert['message']}")
                    
                    # 跟踪活动
                    self.track_user_activity(actions)
                    
                    self.processed_files.add(str(log_file))
                
                # 每10秒检查一次
                time.sleep(10)
                
            except KeyboardInterrupt:
                print("\n[安全监控] 停止运行")
                self.save_report()
                break
            except Exception as e:
                print(f"[错误] {e}")
                time.sleep(10)

    def save_report(self):
        """保存监控报告"""
        report = self.generate_report()
        report_file = LOG_DIR / f"monitor-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"[报告] 已保存: {report_file}")


def main():
    print("="*50)
    print("校园失物招领系统 - 安全监控工具")
    print("="*50)
    
    monitor = SecurityMonitor()
    try:
        monitor.run()
    except KeyboardInterrupt:
        print("\n安全监控已停止")


if __name__ == "__main__":
    main()
