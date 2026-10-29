import datetime
import platform

print("=== SYSTEM INFRASTRUCTURE CHECK ===")
print(f"Time: {datetime.datetime.now()}")
print(f"OS: {platform.system()} {platform.release()}")
print("Status: Testing VS Code + Docker Automation!")