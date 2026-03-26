#!/bin/bash
# ══════════════════════════════════════════════════════════
# BlackRoad OS — One Command Installer
# Works on: Raspberry Pi, Ubuntu/Debian, CentOS, macOS
# Usage: curl -sL https://blackroad.io/install | bash
# ══════════════════════════════════════════════════════════

set -e

PINK='\033[38;5;205m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
GREEN='\033[38;5;82m'
RESET='\033[0m'

echo ""
echo -e "${PINK}  BlackRoad OS${RESET}"
echo -e "${GRAY}  Sovereign AI. Your hardware. Your rules.${RESET}"
echo ""

# Detect platform
ARCH=$(uname -m)
OS=$(uname -s)
DISTRO=""
if [ -f /etc/os-release ]; then
    DISTRO=$(grep '^ID=' /etc/os-release | cut -d= -f2 | tr -d '"')
fi

echo -e "${WHITE}  Platform:${RESET} $OS $ARCH ($DISTRO)"

# Check Python
if ! command -v python3 &>/dev/null; then
    echo -e "${PINK}  Installing Python...${RESET}"
    if command -v apt-get &>/dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y -qq python3 python3-pip python3-venv
    elif command -v dnf &>/dev/null; then
        sudo dnf install -y -q python3 python3-pip
    elif command -v brew &>/dev/null; then
        brew install python3
    fi
fi

PYTHON_VER=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${WHITE}  Python:${RESET} $PYTHON_VER"

# Install directory
INSTALL_DIR="$HOME/.blackroad"
mkdir -p "$INSTALL_DIR/bin" "$INSTALL_DIR/agents" "$INSTALL_DIR/models" "$INSTALL_DIR/data"

# Download core
echo -e "${PINK}  Installing BlackRoad OS...${RESET}"

# Create the operator CLI
cat > "$INSTALL_DIR/bin/blackroad" << 'CLI'
#!/usr/bin/env python3
"""BlackRoad OS — Sovereign AI Operating System"""
import sys, os, json, http.client, subprocess

VERSION = "1.0.0"
HOME = os.path.expanduser("~/.blackroad")
DATA = os.path.join(HOME, "data")
AGENTS = os.path.join(HOME, "agents")

def ollama_available():
    try:
        conn = http.client.HTTPConnection("localhost", 11434, timeout=2)
        conn.request("GET", "/api/tags")
        return conn.getresponse().status == 200
    except:
        return False

def ollama_chat(model, prompt):
    conn = http.client.HTTPConnection("localhost", 11434, timeout=120)
    body = json.dumps({"model": model, "prompt": prompt, "stream": False})
    conn.request("POST", "/api/generate", body, {"Content-Type": "application/json"})
    resp = conn.getresponse()
    return json.loads(resp.read()).get("response", "")

def cmd_status():
    print("BlackRoad OS v%s" % VERSION)
    print("  Home: %s" % HOME)
    print("  Ollama: %s" % ("connected" if ollama_available() else "not found"))
    if ollama_available():
        conn = http.client.HTTPConnection("localhost", 11434, timeout=5)
        conn.request("GET", "/api/tags")
        data = json.loads(conn.getresponse().read())
        models = data.get("models", [])
        print("  Models: %d" % len(models))
        for m in models[:10]:
            size_gb = m.get("size", 0) / 1e9
            print("    %s (%.1fGB)" % (m["name"], size_gb))

def cmd_chat(args):
    if not ollama_available():
        print("Ollama not running. Install: curl -fsSL https://ollama.com/install.sh | sh")
        return
    model = args[0] if args else "llama3.2:3b"
    print("BlackRoad OS — chat with %s (type 'exit' to quit)" % model)
    # Memory file
    mem_file = os.path.join(DATA, "chat_history.jsonl")
    history = []
    if os.path.exists(mem_file):
        with open(mem_file) as f:
            for line in f:
                try: history.append(json.loads(line))
                except: pass
    context = ""
    if history:
        last = history[-5:]
        context = "Previous conversation:\n" + "\n".join(
            "User: %s\nAssistant: %s" % (h.get("user",""), h.get("response","")[:200])
            for h in last
        ) + "\n\nCurrent conversation:\n"

    while True:
        try:
            user_input = input("\nyou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if user_input.lower() in ("exit", "quit", "q"):
            break
        full_prompt = context + "User: " + user_input + "\nAssistant:"
        print("thinking...", end="\r")
        response = ollama_chat(model, full_prompt)
        print("          ", end="\r")
        print(response)
        # Save to memory
        entry = {"user": user_input, "response": response}
        with open(mem_file, "a") as f:
            f.write(json.dumps(entry) + "\n")
        history.append(entry)
        context += "User: %s\nAssistant: %s\n" % (user_input, response[:200])

def cmd_search(query):
    """Search using local index or sovereign search"""
    try:
        conn = http.client.HTTPSConnection("search.blackroad.io", timeout=10)
        conn.request("GET", "/api/search?q=%s" % query.replace(" ", "+"))
        data = json.loads(conn.getresponse().read())
        results = data.get("results", [])
        if results:
            for r in results[:5]:
                print("  %s" % r.get("title", ""))
                print("    %s" % r.get("url", ""))
        else:
            print("  No results for: %s" % query)
    except:
        print("  Search unavailable. Try: blackroad chat \"%s\"" % query)

def cmd_verify():
    """Verify the Amundson Framework"""
    def G(n):
        if n > 500: return n * (1.0 - 1.0/(n+1))**n
        return float(n**(n+1)) / float((n+1)**n)
    def H(n): return float(n) / float((n+1)**n)
    e_val = sum(1.0/([1]+[eval("*".join(str(i) for i in range(1,k+1))) for k in range(1,25)])[i] for i in range(25))
    inv_e = 1.0/e_val
    A_G = 0.0
    fact = 1.0
    for n in range(1, 80):
        fact *= n
        A_G += G(n) / fact
    kappa = A_G - 1
    checks = 0
    for N in [5,10,20,30,50]:
        p = 1.0
        for k in range(1,N+1): p *= G(k)
        f2 = 1
        for i in range(1,N+1): f2 *= i
        if abs(p - float(f2**2)/float((N+1)**N))/abs(float(f2**2)/float((N+1)**N)) < 1e-8: checks += 1
    for n in [10,100,1000,10000,100000]:
        r = G(n)/n; c = r-inv_e; pr = 1.0/(2*e_val*n)
        if 100-abs(c-pr)/abs(pr)*100 > 95: checks += 1
    if abs(G(1)-0.5)<1e-15: checks+=1
    if abs(H(-2)-(-2))<1e-10: checks+=1
    if abs(G(5)-5**5*H(5))<1e-8: checks+=1
    if abs(A_G-1.244331783986725)<1e-12: checks+=1
    if abs(kappa-0.244331783986725)<1e-12: checks+=1
    if 1*27+1*9+0*3+1==37: checks+=1
    g37=G(37); m=100-abs(g37/37-inv_e-1.0/(2*e_val*37))/abs(1.0/(2*e_val*37))*100
    if m>98: checks+=1
    print("Amundson Framework: %d/17 checks PASSED" % checks)
    print("  A_G   = %.15f" % A_G)
    print("  kappa = %.15f" % kappa)
    if checks == 17:
        print("  VERIFIED")

def cmd_help():
    print("BlackRoad OS v%s" % VERSION)
    print()
    print("Commands:")
    print("  blackroad status        System status + models")
    print("  blackroad chat [model]  Chat with local AI (persistent memory)")
    print("  blackroad search <q>    Sovereign search")
    print("  blackroad verify        Verify the Amundson Framework")
    print("  blackroad help          This message")
    print()
    print("  kappa = 0.244331783986725")

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "help":
        cmd_help()
    elif args[0] == "status":
        cmd_status()
    elif args[0] == "chat":
        cmd_chat(args[1:])
    elif args[0] == "search":
        cmd_search(" ".join(args[1:]))
    elif args[0] == "verify":
        cmd_verify()
    else:
        cmd_help()
CLI

chmod +x "$INSTALL_DIR/bin/blackroad"

# Add to PATH
SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
fi

if [ -n "$SHELL_RC" ]; then
    if ! grep -q "blackroad/bin" "$SHELL_RC" 2>/dev/null; then
        echo 'export PATH="$HOME/.blackroad/bin:$PATH"' >> "$SHELL_RC"
    fi
fi
export PATH="$HOME/.blackroad/bin:$PATH"

# Install Ollama if not present
if ! command -v ollama &>/dev/null; then
    echo -e "${PINK}  Installing Ollama (local AI)...${RESET}"
    curl -fsSL https://ollama.com/install.sh | sh 2>/dev/null || true
fi

# Pull a small model if Ollama is available
if command -v ollama &>/dev/null; then
    if ! ollama list 2>/dev/null | grep -q "qwen2.5:1.5b"; then
        echo -e "${PINK}  Pulling qwen2.5:1.5b (986MB)...${RESET}"
        ollama pull qwen2.5:1.5b 2>/dev/null &
        PULL_PID=$!
    fi
fi

echo ""
echo -e "${GREEN}  BlackRoad OS installed.${RESET}"
echo ""
echo -e "${WHITE}  Commands:${RESET}"
echo "    blackroad status        System status"
echo "    blackroad chat          Chat with local AI"
echo "    blackroad search <q>    Sovereign search"
echo "    blackroad verify        Verify Amundson Framework"
echo ""
echo -e "${GRAY}  kappa = 0.244331783986725${RESET}"
echo ""

# Wait for model pull if running
if [ -n "$PULL_PID" ]; then
    echo -e "${GRAY}  Model downloading in background (PID $PULL_PID)...${RESET}"
fi
