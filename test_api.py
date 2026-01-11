import requests
import json
import time

URL = "http://localhost:5000/api/process_voice"
DASHBOARD_API = "http://localhost:5000/api/tasks"

# Mock Input: Hindi speech about a meeting
payload = {
    "text": "Aaj hum project roadmap discuss karenge. Rahul, tum frontend design by Friday complete karo. Amit, database schema kal tak finalize karo. Ye urgent hai."
}

print(f"Sending payload to {URL}...")
try:
    response = requests.post(URL, json=payload)
    print("Status Code:", response.status_code)
    print("Response JSON:", json.dumps(response.json(), indent=2))
    
    if response.status_code == 200:
        print("\nChecking Dashboard API for Tasks...")
        time.sleep(1) # Wait a bit
        task_res = requests.get(DASHBOARD_API)
        tasks = task_res.json()
        print(f"Found {len(tasks)} tasks.")
        for t in tasks:
            print(f"- {t['title']} (Assignee: {t['assignee']}, Priority: {t['priority']}, Risk: {t['risk_level']})")
            
except Exception as e:
    print("Error:", e)
