import sqlite3
import json
from datetime import datetime

DB_NAME = "workflow.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Enable foreign keys
    c.execute("PRAGMA foreign_keys = ON")
    
    # Meetings table
    c.execute('''CREATE TABLE IF NOT EXISTS meetings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    original_transcript TEXT,
                    translated_transcript TEXT,
                    language_detected TEXT,
                    summary TEXT,
                    key_points TEXT, -- Stored as JSON string
                    decisions TEXT -- Stored as JSON string
                )''')

    # Tasks table
    c.execute('''CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    assignee TEXT,
                    deadline TEXT,
                    priority TEXT, -- Low, Medium, High
                    status TEXT DEFAULT 'Pending',
                    risk_level TEXT, -- Low, Medium, High
                    estimated_time TEXT,
                    meeting_id INTEGER,
                    FOREIGN KEY(meeting_id) REFERENCES meetings(id)
                )''')
    
    conn.commit()
    conn.close()

def add_meeting(original_text, translated_text, language, summary, key_points, decisions):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    c.execute('''INSERT INTO meetings 
                 (date, original_transcript, translated_transcript, language_detected, summary, key_points, decisions) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)''',
              (date_str, original_text, translated_text, language, summary, json.dumps(key_points), json.dumps(decisions)))
    
    meeting_id = c.lastrowid
    conn.commit()
    conn.close()
    return meeting_id

def add_task(title, assignee, deadline, priority, estimated_time, risk_level, meeting_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    c.execute('''INSERT INTO tasks 
                 (title, assignee, deadline, priority, estimated_time, risk_level, meeting_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)''',
              (title, assignee, deadline, priority, estimated_time, risk_level, meeting_id))
    
    conn.commit()
    conn.close()

def get_all_tasks():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM tasks ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_latest_meeting():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM meetings ORDER BY id DESC LIMIT 1")
    row = c.fetchone()
    conn.close()
    if row:
        d = dict(row)
        # Parse JSON fields
        try:
            d['key_points'] = json.loads(d['key_points']) if d['key_points'] else []
            d['decisions'] = json.loads(d['decisions']) if d['decisions'] else []
        except:
            pass
        return d
    return None

def delete_task(task_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
