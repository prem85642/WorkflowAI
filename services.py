import re
import os
import requests
from langdetect import detect
# from googletrans import Translator # library is broken on Py3.13
from deep_translator import GoogleTranslator

# -- CONFIGURATION --
HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
HF_API_KEY = os.environ.get("HF_API_KEY", "")

def detect_language(text):
    try:
        lang = detect(text)
        return lang
    except:
        return "unknown"

def translate_text(text, target_lang='en', source_lang='auto'):
    try:
        if not text:
            return ""
        
        # Clean language code (e.g. 'hi-IN' -> 'hi')
        if source_lang and '-' in source_lang and source_lang != 'auto':
            source_lang = source_lang.split('-')[0]
            
        print(f"Translating from {source_lang} to {target_lang}")
        
        # Translate
        translated = GoogleTranslator(source=source_lang, target=target_lang).translate(text)
        return translated
    except Exception as e:
        print(f"Translation error: {e}")
        return text

def generate_mom(text, hf_token=None):
    """
    Generates MoM using Hugging Face API if token is provided, otherwise uses improved heuristics.
    """
    token = hf_token if hf_token else HF_API_KEY
    
    # Try AI generation if token exists and text is sufficient
    if token and len(text.split()) > 5:
        headers = {"Authorization": f"Bearer {token}"}
        # Simplified prompt to encourage valid JSON
        prompt = f"""[INST] You are a professional project manager. Analyze this meeting transcript.
        
        Transcript: "{text}"

        Output a strict JSON object with these keys:
        - "summary": (string) Brief summary
        - "key_points": (list of strings) Important points
        - "action_items": (list of strings) Tasks to be done
        - "decisions": (list of strings) Decisions made
        
        Do not include markdown formatting like ```json. Return ONLY the JSON. [/INST]"""
        
        payload = {
            "inputs": prompt, 
            "parameters": {
                "max_new_tokens": 1000, 
                "return_full_text": False, 
                "temperature": 0.1 # Lower temperature for consistency
            }
        }
        
        try:
            response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=10)
            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0:
                    generated_text = result[0]['generated_text']
                    
                    # Clean up markdown code blocks if present
                    clean_text = generated_text.replace("```json", "").replace("```", "").strip()
                    
                    # Robust JSON extraction
                    start = clean_text.find('{')
                    end = clean_text.rfind('}') + 1
                    if start != -1 and end != -1:
                        json_str = clean_text[start:end]
                        data = json.loads(json_str)
                        # Ensure fields exist
                        data.setdefault("summary", "Summary not generated.")
                        data.setdefault("key_points", [])
                        data.setdefault("action_items", [])
                        data.setdefault("decisions", [])
                        return data
            else:
                print(f"HF API Error Status: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"HF API/Parsing Error: {e}. Falling back to smart rules.")
            
    # -- Enhanced Rule-Based MoM Fallback --
    print("Using Rule-Based MoM Fallback")
    sentences = [s.strip() for s in re.split(r'[.!?]\s*', text) if len(s) > 5]
    
    if not sentences:
        return {
            "summary": "No content detected.", 
            "key_points": [], 
            "action_items": [], 
            "decisions": []
        }

    summary = "Meeting Discussion: " + ". ".join(sentences[:3]) + "."
    
    # Better Action Detection
    action_keywords = ["assign", "task", "todo", "must", "should", "will", "deadline", "responsibility", "duty", "needs to"]
    action_items = [s for s in sentences if any(k in s.lower() for k in action_keywords)]
    
    decisions = []
    decision_keywords = ["decided", "agreed", "finalized", "conclusion", "approved", "resolved"]
    decisions = [s for s in sentences if any(k in s.lower() for k in decision_keywords)]
    
    if not decisions: decisions = ["No explicit decisions recorded."]

    return {
        "summary": summary,
        "key_points": sentences[:5], # Take first 5 sentences as key points
        "action_items": action_items,
        "decisions": decisions
    }

def extract_tasks_logic(text, action_items_from_mom):
    """
    Extracts structured tasks.
    """
    tasks = []
    
    # Combine sources but prioritize action items from MoM which might be cleaner
    sources = set(action_items_from_mom)
    
    # Also look at raw text if MoM missed things
    raw_sentences = [s.strip() for s in re.split(r'[.!?;]\s*', text) if len(s)>5]
    for s in raw_sentences:
        sources.add(s)
    
    # Common Team Names (Expandable)
    common_names = ["Rahul", "Amit", "Rohan", "Priya", "Sarah", "David", "Ankit", "Sneha", "Vikram", "User", "Admin", "Manager"] 
    
    for item in sources:
        item = item.strip()
        if not item: continue
        lower_item = item.lower()
        
        # Task Indicators
        task_indicators = [
            "assign", "task", "due", "by", "needs to", "has to", "must", "should",
            "complete", "finish", "submit", "prepare", "check", "verify", "do it"
        ]
        
        if any(k in lower_item for k in task_indicators):
            
            # --- Assignee Logic ---
            assignee = "Unassigned"
            
            # 1. "Assign X to [Name]" or "Assign [Name] to X" (Ambiguous, but let's try)
            # Pattern: "Assign to [Name]"
            match_assign_to = re.search(r'assign(?:ed)?\s+(?:task\s+)?to\s+([A-Z][a-z]+)', item)
            
            # Pattern: "[Name] has to..."
            match_actor = re.search(r'^([A-Z][a-z]+)\s+(?:has to|needs to|must|should|will)', item)
            
            # Pattern: Direct "Name, please..."
            match_direct = re.search(r'^([A-Z][a-z]+),?\s+(?:please|kindly)', item, re.IGNORECASE)

            if match_assign_to:
                assignee = match_assign_to.group(1)
            elif match_actor:
                name = match_actor.group(1)
                if name.lower() not in ["he", "she", "it", "this", "that", "the", "we", "i", "you", "they"]:
                    assignee = name
            elif match_direct:
                name = match_direct.group(1)
                if name.lower() not in ["he", "she", "it", "they"]:
                    assignee = name
            
            # Name Lookup Fallback
            if assignee == "Unassigned":
                for name in common_names:
                    # check for whole word match
                    if re.search(r'\b' + name + r'\b', item, re.IGNORECASE):
                        assignee = name
                        break

            # --- Deadline Logic ---
            deadline = "No Deadline"
            # Look for "by [Time]" or "on [Time]"
            match_dead = re.search(r'(?:by|before|on|due)\s+(.+?)(?:$|[.,])', item, re.IGNORECASE)
            if match_dead:
                candidate = match_dead.group(1).strip()
                if len(candidate.split()) < 5: # Valid short deadline
                    deadline = candidate
            elif "tomorrow" in lower_item: deadline = "Tomorrow"
            elif "today" in lower_item: deadline = "Today"
            elif "next week" in lower_item: deadline = "Next Week"
            
            # --- Priority Logic ---
            priority = "Medium"
            risk = "Low"
            if any(w in lower_item for w in ["urgent", "asap", "immediate", "critical", "high priority", "quickly"]):
                priority = "High"
                risk = "High"
            elif any(w in lower_item for w in ["later", "low priority", "whenever"]):
                priority = "Low"
            
            # --- Title Cleanup ---
            clean_title = item
            # If starts with name, strip it. "Rahul has to..." -> "has to..." -> "Complete..."
            if assignee != "Unassigned" and clean_title.lower().startswith(assignee.lower()):
                clean_title = clean_title[len(assignee):].strip(" ,.-")
                # Remove leading verbs if awkward? Nah, just capitalize.
            
            clean_title = clean_title.capitalize()
            
            tasks.append({
                "title": clean_title,
                "assignee": assignee,
                "deadline": deadline,
                "priority": priority,
                "risk_level": risk,
                "estimated_time": "1h" # Default
            })
            
    return tasks
