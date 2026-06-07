// --- CONFIGURACJA BAZY ---
const firebaseConfig = {
    apiKey: "AIzaSyD7DlhKM5AwCavHvaHTP3fclbadPM7bAJY",
    authDomain: "ocet-chess.firebaseapp.com",
    databaseURL: "https://ocet-chess-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ocet-chess",
    storageBucket: "ocet-chess.firebasestorage.app",
    messagingSenderId: "947677134465",
    appId: "1:947677134465:web:1c0afd899ceb77f0e9d780"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

let user = { uid: null, displayName: "", elo: 400, isGuest: true, avatar: "" };
let isRegistering = false, isInQueue = false, roomId = null, myColor = null, currentTurn = "white";
let gameBoard = [], validMoves = [], selectedSquare = null, lastMove = null, historyLog = [], isGameOver = false, promotionPending = null;
let castlingRights = { w_short: true, w_long: true, b_short: true, b_long: true };
let gameData = {}, activeChallenge = null;
let timerInterval = null, whiteTimeLeft = 0, blackTimeLeft = 0, lastMoveTimestamp = 0;

// Zmienna lokalna odpowiadająca za aktualną skórkę figur
let currentTheme = "classic";

const initialBoard = [
    ['b_photo2', 'b_photo3', 'b_photo4', 'b_photo5', 'b_photo6', 'b_photo4', 'b_photo3', 'b_photo2'],
    ['b_photo1', 'b_photo1', 'b_photo1', 'b_photo1', 'b_photo1', 'b_photo1', 'b_photo1', 'b_photo1'],
    ['', '', '', '', '', '', '', ''], ['', '', '', '', '', '', '', ''], ['', '', '', '', '', '', '', ''], ['', '', '', '', '', '', '', ''],
    ['w_photo1', 'w_photo1', 'w_photo1', 'w_photo1', 'w_photo1', 'w_photo1', 'w_photo1', 'w_photo1'],
    ['w_photo2', 'w_photo3', 'w_photo4', 'w_photo5', 'w_photo6', 'w_photo4', 'w_photo3', 'w_photo2']
];

function generateRandomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let code = "";
    for(let i=0; i<6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length)); return code;
}

// Funkcja zamieniająca nazwy wewnętrzne na odpowiednie pliki graficzne (obsługuje photo9-14)
function getPieceImgSrc(pieceStr) {
    if (!pieceStr) return "";
    const name = pieceStr.substring(2); // np. "photo1"
    if (currentTheme === "alternative") {
        if (name === "photo1") return "photo9.png";
        if (name === "photo2") return "photo10.png";
        if (name === "photo3") return "photo11.png";
        if (name === "photo4") return "photo12.png";
        if (name === "photo5") return "photo13.png";
        if (name === "photo6") return "photo14.png";
    }
    return name + ".png";
}

function changeChessTheme() {
    currentTheme = document.getElementById('theme-select').value;
    updateUI();
}

auth.onAuthStateChanged(firebaseUser => {
    if (firebaseUser) {
        const isPasswordLogin = firebaseUser.providerData.some(p => p.providerId === 'password');
        if (isPasswordLogin && !firebaseUser.emailVerified) { auth.signOut(); alert("Zweryfikuj swój adres e-mail!"); showAuth(); return; }
        
        database.ref('users/' + firebaseUser.uid).on('value', snapshot => {
            const data = snapshot.val();
            if (data) {
                user = { uid: firebaseUser.uid, displayName: data.displayName, elo: data.elo, isGuest: false, avatar: data.avatar || "" };
                database.ref('nicknames/' + data.displayName.toLowerCase()).set(firebaseUser.uid);
                if(user.avatar) document.getElementById('menu-user-avatar').src = user.avatar;
                showMenu(); updatePresence("online"); listenForChallenges(); loadFriendsList();
            }
        });
    } else { if(!user.isGuest) showAuth(); }
});

function updatePresence(status) {
    if(!user.uid || user.isGuest) return;
    database.ref('presence/' + user.uid).set({ name: user.displayName, status: status, elo: user.elo });
    if(status === "online") database.ref('presence/' + user.uid).onDisconnect().remove();
}

function triggerAvatarUpload() { document.getElementById('avatar-input').click(); }
function uploadAvatar(event) {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maksymalna wielkość to 5MB."); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
            const maxW = 120, maxH = 120; let w = img.width, h = img.height;
            if (w > h) { if (w > maxW) { h *= maxW / w; w = maxW; } } else { if (h > maxH) { w *= maxH / h; h = maxH; } }
            canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h);
            const base64Str = canvas.toDataURL('image/jpeg', 0.7);
            database.ref('users/' + user.uid + '/avatar').set(base64Str).then(() => alert("Awatar zaktualizowany!"));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function addFriendByNick() {
    const nickInput = document.getElementById('friend-nick-input').value.trim();
    if(!nickInput) return alert("Wpisz nick!");
    if(nickInput.toLowerCase() === user.displayName.toLowerCase()) return alert("Nie możesz dodać siebie!");
    database.ref('nicknames/' + nickInput.toLowerCase()).once('value', snap => {
        if(!snap.exists()) return alert("Nie znaleziono takiego gracza!");
        const friendUid = snap.val();
        database.ref(`friends/${user.uid}/${friendUid}`).set(true).then(() => {
            alert(`Dodano ${nickInput} do znajomych!`);
            document.getElementById('friend-nick-input').value = "";
        });
    });
}

function loadFriendsList() {
    database.ref(`friends/${user.uid}`).on('value', snapshot => {
        const box = document.getElementById('friends-box'); box.innerHTML = ""; const friends = snapshot.val();
        if(!friends) { box.innerHTML = "<div style='color:#666; font-size:0.85rem;'>Brak znajomych.</div>"; return; }
        for(let fUid in friends) {
            database.ref(`presence/${fUid}`).once('value', presSnap => {
                const pres = presSnap.val();
                const statusClass = pres ? (pres.status === 'online' ? 'status-online' : 'status-ingame') : 'status-offline';
                const item = document.createElement('div'); item.className = 'friend-item';
                item.innerHTML = `
                    <div class="friend-info"><span class="status-dot ${statusClass}"></span><span>${pres ? pres.name : 'Gracz'} (${pres ? pres.elo : '---'})</span></div>
                    ${pres && pres.status === 'online' ? `<button class="btn-challenge" onclick="challengeFriend('${fUid}')">Wyzwij</button>` : ''}
                `;
                box.appendChild(item);
            });
        }
    });
}

function challengeFriend(fUid) {
    const tc = parseInt(document.getElementById('time-control').value);
    const cCode = generateRandomCode();
    
    // NAPRAWIONO: Zapraszający najpierw tworzy i zapisuje pokój w bazie
    database.ref('rooms/' + cCode).set({
        board: initialBoard, turn: 'white', isGameOver: false, isRanked: false, timeControl: tc,
        whiteTime: tc * 1000, blackTime: tc * 1000, drawOfferedBy: "",
        lastMoveTimestamp: firebase.database.ServerValue.TIMESTAMP,
        players: { 
            // Zapraszający automatycznie zajmuje losowy kolor, tak jak w standardowym pokoju
            [Math.random() < 0.5 ? "white" : "black"]: { uid: user.uid, name: user.displayName, elo: user.elo, avatar: user.avatar } 
        },
        historyLog: [], castlingRights: { w_short: true, w_long: true, b_short: true, b_long: true }
    }).then(() => {
        // Dopiero gdy pokój fizycznie istnieje w bazie, wysyłamy wyzwanie do znajomego
        database.ref(`challenges/${fUid}`).set({ 
            fromName: user.displayName, 
            fromUid: user.uid, 
            timeControl: tc, 
            code: cCode 
        });
        
        // Zapraszający od razu wchodzi do swojego nowo utworzonego pokoju i czeka
        roomId = cCode;
        listenToRoom();
        alert("Wysłano wyzwanie! Oczekiwanie na dołączenie znajomego...");
    }).catch(e => alert("Błąd wyzwania: " + e.message));
}

function listenForChallenges() {
    database.ref(`challenges/${user.uid}`).on('value', snapshot => {
        const challenge = snapshot.val();
        if(challenge) {
            activeChallenge = challenge;
            document.getElementById('challenge-text').innerText = `${challenge.fromName} wyzywa Cię na partię (${challenge.timeControl/60} min)!`;
            document.getElementById('challenge-modal').style.display = 'flex';
        } else { document.getElementById('challenge-modal').style.display = 'none'; }
    });
}

function respondChallenge(accepted) {
    if(!activeChallenge) return; 
    const c = activeChallenge; 
    
    // Usuwamy wyzwanie, żeby nie wisiało w bazie
    database.ref(`challenges/${user.uid}`).remove();
    
    if(accepted) { 
        isInQueue = false; 
        // Dołączamy do pokoju o kodzie wygenerowanym przez zapraszającego
        attemptJoinRoom(c.code); 
    }
    activeChallenge = null;
}

function sendChatMessage() {
    const inp = document.getElementById('chat-input'); const msg = inp.value.trim(); if(!msg || !roomId) return;
    database.ref(`rooms/${roomId}/chat`).push({ name: user.displayName, text: msg }); inp.value = "";
}
function listenToChat() {
    database.ref(`rooms/${roomId}/chat`).on('child_added', snapshot => {
        const m = snapshot.val(); const box = document.getElementById('chat-box');
        box.innerHTML += `<div><strong style="color:var(--accent)">${m.name}:</strong> ${m.text}</div>`;
        box.scrollTop = box.scrollHeight;
    });
}

function toggleRegister() {
    isRegistering = !isRegistering;
    document.getElementById('auth-nick').style.display = isRegistering ? 'block' : 'none';
    document.getElementById('btn-toggle-reg').innerText = isRegistering ? 'Mam już konto (Zaloguj)' : 'Chcę założyć konto';
    document.querySelector('#login-form button:nth-of-type(3)').innerText = isRegistering ? 'Zarejestruj się' : 'Zaloguj się';
}
function login() {
    const email = document.getElementById('auth-email').value.trim(), pass = document.getElementById('auth-pass').value, nick = document.getElementById('auth-nick').value.trim();
    if (!email || !pass) return alert("Podaj e-mail i hasło!");
    if (isRegistering) {
        if(!nick) return alert("Podaj nick!");
        database.ref('nicknames').child(nick.toLowerCase()).once('value', snap => {
            if(snap.exists()) return alert("Ten nick jest już zajęty!");
            auth.createUserWithEmailAndPassword(email, pass).then(cred => {
                database.ref('users/' + cred.user.uid).set({ displayName: nick, elo: 400, avatar: "" });
                database.ref('nicknames/' + nick.toLowerCase()).set(cred.user.uid);
                cred.user.sendEmailVerification().then(() => { alert("Potwierdź link na e-mailu."); auth.signOut(); toggleRegister(); });
            }).catch(e => alert(e.message));
        });
    } else { auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message)); }
}
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(cred => {
        database.ref('users/' + cred.user.uid).once('value', snap => {
            if (!snap.exists()) {
                let chosenNick = "";
                let checkNick = () => {
                    chosenNick = prompt("Podaj swój unikalny nick do gry:"); if(chosenNick === null) { auth.signOut(); return; }
                    chosenNick = chosenNick.trim(); if(!chosenNick) return checkNick();
                    database.ref('nicknames').child(chosenNick.toLowerCase()).once('value', nickSnap => {
                        if(nickSnap.exists()) { alert("Ten nick jest zajęty!"); checkNick(); } 
                        else {
                            database.ref('users/' + cred.user.uid).set({ displayName: chosenNick, elo: 400, avatar: "" });
                            database.ref('nicknames/' + chosenNick.toLowerCase()).set(cred.user.uid);
                        }
                    });
                };
                checkNick();
            }
        });
    }).catch(e => alert(e.message));
}
function playAsGuest() {
    const nick = document.getElementById('guest-nick').value.trim() || "Gość_" + Math.floor(Math.random()*1000);
    user = { uid: "guest_" + Date.now(), displayName: nick, elo: "Brak", isGuest: true, avatar: "" }; showMenu();
}
function logout() { updatePresence("offline"); user.isGuest = true; auth.signOut(); showAuth(); }
function showAuth() { document.getElementById('auth-screen').style.display = 'flex'; document.getElementById('menu-screen').style.display = 'none'; document.getElementById('game-screen').style.display = 'none'; }
function showMenu() {
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('menu-screen').style.display = 'flex'; document.getElementById('game-screen').style.display = 'none';
    document.getElementById('menu-player-name').innerText = user.displayName + (user.isGuest ? " (GOŚĆ)" : "");
    document.getElementById('menu-player-elo').innerText = "ELO: " + user.elo;
    const btnMatch = document.getElementById('btn-matchmaking');
    if(user.isGuest) { btnMatch.disabled = true; btnMatch.innerText = "Matchmaking zablokowany dla gości"; } else { btnMatch.disabled = false; btnMatch.innerText = "Szukaj przeciwnika"; }
}

function createPrivateGame() { const tc = parseInt(document.getElementById('time-control').value); isInQueue = false; initRoom(generateRandomCode(), tc, false); }
function joinPrivateGame() { const code = document.getElementById('join-code-input').value.trim().toUpperCase(); if(code.length !== 6) return alert("Kod ma 6 znaków."); isInQueue = false; attemptJoinRoom(code); }
function startMatchmaking() {
    const tc = parseInt(document.getElementById('time-control').value); const queueRef = database.ref('matchmaking/queue_' + tc);
    document.getElementById('matchmaking-status').innerText = "Szukanie przeciwnika...";
    queueRef.once('value', snapshot => {
        const rooms = snapshot.val(); let foundRoom = null;
        if(rooms) { for(let rId in rooms) { if(rooms[rId] === true) { foundRoom = rId; break; } } }
        if(foundRoom) { queueRef.child(foundRoom).remove(); isInQueue = false; attemptJoinRoom(foundRoom); } 
        else { const newCode = generateRandomCode(); isInQueue = true; initRoom(newCode, tc, true); queueRef.child(newCode).set(true); }
    }).catch(e => alert("Błąd kolejki: " + e.message));
}

function initRoom(code, timeControlSeconds, isRanked) {
    roomId = code; myColor = Math.random() < 0.5 ? "white" : "black";
    database.ref('rooms/' + roomId).set({
        board: initialBoard, turn: 'white', isGameOver: false, isRanked: isRanked, timeControl: timeControlSeconds,
        whiteTime: timeControlSeconds * 1000, blackTime: timeControlSeconds * 1000, drawOfferedBy: "",
        lastMoveTimestamp: firebase.database.ServerValue.TIMESTAMP,
        players: { [myColor]: { uid: user.uid, name: user.displayName, elo: user.elo, avatar: user.avatar } },
        historyLog: [], castlingRights: { w_short: true, w_long: true, b_short: true, b_long: true }
    }).then(() => { updatePresence("playing"); listenToRoom(); }).catch(e => alert("Błąd bazy: " + e.message));
}

function attemptJoinRoom(code) {
    roomId = code;
    database.ref('rooms/' + roomId).once('value', snapshot => {
        const data = snapshot.val(); 
        if(!data) return alert("Pokój nie istnieje!");
        
        // Zabezpieczenie: sprawdźmy kto już siedzi w pokoju
        const hasWhite = data.players && data.players.white;
        const hasBlack = data.players && data.players.black;
        
        if(hasWhite && hasBlack) return alert("Pokój jest już pełny!");
        
        // KLUCZOWA POPRAWKA: Jeśli biały jest zajęty, Ty jesteś czarnym. Jeśli nie, wskakujesz na białego.
        myColor = hasWhite ? 'black' : 'white';
        
        // Aktualizujemy dane pokoju w bazie, dodając Twojego gracza na wolny kolor
        database.ref(`rooms/${roomId}/players/${myColor}`).set({ 
            uid: user.uid, 
            name: user.displayName, 
            elo: user.elo, 
            avatar: user.avatar 
        }).then(() => {
            // Odświeżamy timestamp, żeby zasygnalizować obu przeglądarkom start meczu
            database.ref(`rooms/${roomId}/lastMoveTimestamp`).set(firebase.database.ServerValue.TIMESTAMP);
            updatePresence("playing"); 
            listenToRoom();
        });
    });
}
function listenToRoom() {
    document.getElementById('menu-screen').style.display = 'none'; document.getElementById('game-screen').style.display = 'flex';
    document.getElementById('room-display-code').innerText = `KOD: ${roomId}`; document.getElementById('chat-box').innerHTML = "";
    database.ref('rooms/' + roomId).off();
    database.ref('rooms/' + roomId).on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
            gameData = data; gameBoard = data.board; currentTurn = data.turn; lastMove = data.lastMove || null; isGameOver = data.isGameOver || false;
            historyLog = data.historyLog || []; castlingRights = data.castlingRights || { w_short: true, w_long: true, b_short: true, b_long: true };
            whiteTimeLeft = data.whiteTime; blackTimeLeft = data.blackTime; lastMoveTimestamp = data.lastMoveTimestamp;
            updateUI();
            if(!isGameOver && data.players && data.players.white && data.players.black) startLocalTimer();
        }
    });
    listenToChat();
}

function handleActionButton() {
    const hasOpponent = gameData.players && gameData.players.white && gameData.players.black;
    if (!hasOpponent) {
        clearInterval(timerInterval); database.ref('rooms/' + roomId).off();
        if (isInQueue) database.ref('matchmaking/queue_' + gameData.timeControl).child(roomId).remove();
        database.ref('rooms/' + roomId).remove(); roomId = null; myColor = null; gameData = {}; isInQueue = false; showMenu(); updatePresence("online");
    } else { if(!isGameOver) triggerGameOver("Poddanie się!", myColor === 'white' ? 'black' : 'white'); }
}

function proposeDraw() { if(isGameOver || !roomId || gameData.drawOfferedBy) return; database.ref(`rooms/${roomId}/drawOfferedBy`).set(myColor); alert("Zaproponowano remis."); }
function respondDraw(accepted) { if(accepted) { triggerGameOver("Remis za zgodą obu stron!", null); } else { database.ref(`rooms/${roomId}/drawOfferedBy`).set(""); } }

function startLocalTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if(isGameOver) return clearInterval(timerInterval);
        const elapsed = Math.max(0, Date.now() - lastMoveTimestamp);
        let wTime = whiteTimeLeft, bTime = blackTimeLeft;
        if (currentTurn === 'white') wTime -= elapsed; else bTime -= elapsed;
        updateTimerDisplays(wTime, bTime);
        if (currentTurn === myColor && ((myColor === 'white' && wTime <= 0) || (myColor === 'black' && bTime <= 0))) {
            clearInterval(timerInterval); triggerGameOver("Czas minął!", myColor === 'white' ? 'black' : 'white');
        }
    }, 100);
}
function updateTimerDisplays(wMs, bMs) {
    const oppColor = myColor === 'white' ? 'black' : 'white';
    const format = (ms) => { if(ms < 0) ms = 0; let s = Math.floor(ms / 1000); let m = Math.floor(s / 60); s = s % 60; return `${m}:${s.toString().padStart(2, '0')}`; };
    document.getElementById('my-timer').innerText = format(myColor === 'white' ? wMs : bMs);
    document.getElementById('opp-timer').innerText = format(oppColor === 'white' ? wMs : bMs);
}

function getPieceName(pieceStr) {
    if (!pieceStr) return ""; const color = pieceStr.startsWith('w_') ? "Biały" : "Czarny"; let type = "";
    if (pieceStr.endsWith('photo1')) type = "Pion"; if (pieceStr.endsWith('photo2')) type = "Wieża"; if (pieceStr.endsWith('photo3')) type = "Skoczek";
    if (pieceStr.endsWith('photo4')) type = "Goniec"; if (pieceStr.endsWith('photo5')) type = "Hetman"; if (pieceStr.endsWith('photo6')) type = "Król";
    return `${color} ${type}`;
}

function getPseudoLegalMoves(row, col, boardToUse = gameBoard) {
    const moves = []; const piece = boardToUse[row][col]; if (!piece) return moves;
    const color = piece.startsWith('w_') ? 'white' : 'black', enemyPrefix = color === 'white' ? 'b_' : 'w_', myPrefix = color === 'white' ? 'w_' : 'b_';
    if (piece.endsWith('photo1')) {
        const dir = color === 'white' ? -1 : 1; const startRow = color === 'white' ? 6 : 1;
        if (row + dir >= 0 && row + dir < 8 && boardToUse[row + dir][col] === '') {
            moves.push({ row: row + dir, col: col, type: 'normal' });
            if (row === startRow && boardToUse[row + 2 * dir][col] === '') moves.push({ row: row + 2 * dir, col: col, type: 'normal' });
        }
        [-1, 1].forEach(dc => {
            const c = col + dc;
            if (c >= 0 && c < 8 && row + dir >= 0 && row + dir < 8 && boardToUse[row + dir][c] && boardToUse[row + dir][c].startsWith(enemyPrefix)) moves.push({ row: row + dir, col: c, type: 'normal' });
        });
        if (lastMove && lastMove.piece.endsWith('photo1') && Math.abs(lastMove.from.row - lastMove.to.row) === 2 && row === lastMove.to.row && Math.abs(lastMove.to.col - col) === 1) moves.push({ row: lastMove.to.row + dir, col: lastMove.to.col, type: 'enPassant' });
    } 
    if (piece.endsWith('photo2') || piece.endsWith('photo5')) {
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                if (boardToUse[r][c] === '') moves.push({ row: r, col: c, type: 'normal' });
                else { if (boardToUse[r][c].startsWith(enemyPrefix)) moves.push({ row: r, col: c, type: 'normal' }); break; }
                r += dr; c += dc;
            }
        });
    }
    if (piece.endsWith('photo4') || piece.endsWith('photo5')) {
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => {
            let r = row + dr, c = col + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                if (boardToUse[r][c] === '') moves.push({ row: r, col: c, type: 'normal' });
                else { if (boardToUse[r][c].startsWith(enemyPrefix)) moves.push({ row: r, col: c, type: 'normal' }); break; }
                r += dr; c += dc;
            }
        });
    }
    if (piece.endsWith('photo3')) {
        [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]].forEach(([dr, dc]) => {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8 && !boardToUse[r][c].startsWith(myPrefix)) moves.push({ row: r, col: c, type: 'normal' });
        });
    }
    if (piece.endsWith('photo6')) {
        [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr, dc]) => {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8 && !boardToUse[r][c].startsWith(myPrefix)) moves.push({ row: r, col: c, type: 'normal' });
        });
        if (!isKingInCheck(color, boardToUse)) {
            if (color === 'white' && row === 7 && col === 4) {
                if (castlingRights.w_short && boardToUse[7][5]==='' && boardToUse[7][6]==='') moves.push({ row: 7, col: 6, type: 'castle_short' });
                if (castlingRights.w_long && boardToUse[7][3]==='' && boardToUse[7][2]==='' && boardToUse[7][1]==='') moves.push({ row: 7, col: 2, type: 'castle_long' });
            }
            if (color === 'black' && row === 0 && col === 4) {
                if (castlingRights.b_short && boardToUse[0][5]==='' && boardToUse[0][6]==='') moves.push({ row: 0, col: 6, type: 'castle_short' });
                if (castlingRights.b_long && boardToUse[0][3]==='' && boardToUse[0][2]==='' && boardToUse[0][1]==='') moves.push({ row: 0, col: 2, type: 'castle_long' });
            }
        }
    }
    return moves;
}

function isKingInCheck(color, boardToUse) {
    let kingRow = -1, kingCol = -1; const targetKing = color === 'white' ? 'w_photo6' : 'b_photo6';
    for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { if (boardToUse[r][c] === targetKing) { kingRow = r; kingCol = c; break; } } }
    if (kingRow === -1) return false; const enemyColor = color === 'white' ? 'black' : 'white';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (boardToUse[r][c] && boardToUse[r][c].startsWith(enemyColor === 'white' ? 'w_' : 'b_' ) && !boardToUse[r][c].endsWith('photo6')) {
                if (getPseudoLegalMoves(r, c, boardToUse).find(m => m.row === kingRow && m.col === kingCol)) return true;
            }
        }
    }
    return false;
}

function getValidMoves(row, col, boardToUse = gameBoard) {
    if(!boardToUse[row][col]) return []; const color = boardToUse[row][col].startsWith('w_') ? 'white' : 'black';
    return getPseudoLegalMoves(row, col, boardToUse).filter(move => {
        const virtualBoard = JSON.parse(JSON.stringify(boardToUse));
        virtualBoard[move.row][move.col] = virtualBoard[row][col]; virtualBoard[row][col] = '';
        if (move.type === 'enPassant' && lastMove) virtualBoard[lastMove.to.row][lastMove.to.col] = '';
        return !isKingInCheck(color, virtualBoard);
    });
}

function handleSquareClick(row, col) {
    // --- BLOK DIAGNOSTYCZNY (Wyświetli błędy w konsoli pod F12) ---
    if (isGameOver) { console.log("Kliknięcie odrzucone: Gra się skończyła."); return; }
    if (!myColor) { console.log("Kliknięcie odrzucone: Nie przypisano Ci koloru."); return; }
    if (currentTurn !== myColor) { console.log(`Kliknięcie odrzucone: To nie Twój ruch. Tura: ${currentTurn}, Twój kolor: ${myColor}`); return; }
    if (!gameData.players || !gameData.players.white || !gameData.players.black) { 
        console.log("Kliknięcie odrzucone: Brak kompletnych danych o graczach w bazie pokoju.", gameData.players); 
        return; 
    }
    // --------------------------------------------------------------

    const isHint = validMoves.find(m => m.row === row && m.col === col);
    if (isHint) { 
        executeMove(selectedSquare.row, selectedSquare.col, row, col, isHint.type); 
        selectedSquare = null; 
        validMoves = []; 
    } else {
        const clickedPiece = gameBoard[row][col];
        if (clickedPiece && clickedPiece.startsWith(myColor.charAt(0))) { 
            selectedSquare = { row, col }; 
            validMoves = getValidMoves(row, col, gameBoard); 
            updateUI(); 
        } else { 
            selectedSquare = null; 
            validMoves = []; 
            updateUI(); 
        }
    }
}

function executeMove(fromRow, fromCol, toRow, toCol, type) {
    let piece = gameBoard[fromRow][fromCol];
    if (type === 'enPassant') gameBoard[lastMove.to.row][lastMove.to.col] = '';
    if (type === 'castle_short') { gameBoard[toRow][5] = gameBoard[toRow][7]; gameBoard[toRow][7] = ''; }
    if (type === 'castle_long') { gameBoard[toRow][3] = gameBoard[toRow][0]; gameBoard[toRow][0] = ''; }
    if (piece === 'w_photo6') { castlingRights.w_short = false; castlingRights.w_long = false; }
    if (piece === 'b_photo6') { castlingRights.b_short = false; castlingRights.b_long = false; }
    const cols = ['a','b','c','d','e','f','g','h'];
    historyLog.push(`${currentTurn==='white'?'B':'C'}: ${piece.split('_')[1]} ${cols[fromCol]}${8-fromRow}→${cols[toCol]}${8-toRow}`);
    gameBoard[toRow][toCol] = piece; gameBoard[fromRow][fromCol] = '';
    const moveData = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol }, piece: piece };
    if (piece.endsWith('photo1') && (toRow === 0 || toRow === 7)) { promotionPending = moveData; openPromotionModal(); return; }
    finalizeTurn(moveData);
}

function openPromotionModal() {
    const container = document.getElementById('promotion-choices-container');
    container.innerHTML = '';
    const items = [
        { id: 'photo5', name: 'Hetman' }, { id: 'photo2', name: 'Wieża' },
        { id: 'photo4', name: 'Goniec' }, { id: 'photo3', name: 'Skoczek' }
    ];
    items.forEach(item => {
        const img = document.createElement('img');
        img.className = 'promo-choice';
        // Generujemy poprawny wygląd figury w modalu awansu (photo5 vs photo13)
        img.src = currentTheme === 'alternative' ? getPieceImgSrc((myColor === 'white' ? 'w_' : 'b_') + item.id) : item.id + '.png';
        img.onclick = () => choosePromotion(item.id);
        container.appendChild(img);
    });
    document.getElementById('promotion-modal').style.display = 'flex';
}

function choosePromotion(chosenPhoto) {
    if (!promotionPending) return; gameBoard[promotionPending.to.row][promotionPending.to.col] = (myColor === 'white' ? 'w_' : 'b_') + chosenPhoto;
    document.getElementById('promotion-modal').style.display = 'none'; const m = promotionPending; promotionPending = null; finalizeTurn(m);
}

function finalizeTurn(moveData) {
    const nextTurn = currentTurn === 'white' ? 'black' : 'white', elapsed = Math.max(0, Date.now() - lastMoveTimestamp);
    let wTime = whiteTimeLeft, bTime = blackTimeLeft; if (currentTurn === 'white') wTime -= elapsed; else bTime -= elapsed;
    
    let hasAnyMoves = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (gameBoard[r][c] && gameBoard[r][c].startsWith(nextTurn.charAt(0)) && getValidMoves(r, c, gameBoard).length > 0) { hasAnyMoves = true; break; }
        }
        if (hasAnyMoves) break;
    }
    let updates = { board: gameBoard, turn: nextTurn, lastMove: moveData, historyLog: historyLog, castlingRights: castlingRights, whiteTime: wTime, blackTime: bTime, lastMoveTimestamp: firebase.database.ServerValue.TIMESTAMP, drawOfferedBy: "" };
    if (!hasAnyMoves) {
        if (isKingInCheck(nextTurn, gameBoard)) triggerGameOver("SZACH MAT!", currentTurn, updates);
        else triggerGameOver("PAT (Remis)!", null, updates);
    } else { database.ref('rooms/' + roomId).update(updates); }
}

function triggerGameOver(reason, winnerColor, baseUpdates = {}) {
    clearInterval(timerInterval); let updates = { ...baseUpdates, isGameOver: true, endMessage: reason };
    if (gameData.isRanked && winnerColor && !gameData.eloProcessed) {
        let winnerUid = gameData.players[winnerColor].uid, loserColor = winnerColor === 'white' ? 'black' : 'white', loserUid = gameData.players[loserColor].uid;
        let winElo = gameData.players[winnerColor].elo, losElo = gameData.players[loserColor].elo;
        let expectedWin = 1 / (1 + Math.pow(10, (losElo - winElo) / 400)), eloChange = Math.round(32 * (1 - expectedWin));
        updates.eloProcessed = true; updates.eloChangeMsg = `${gameData.players[winnerColor].name} +${eloChange} | ${gameData.players[loserColor].name} -${eloChange}`;
        database.ref('users/' + winnerUid + '/elo').set(winElo + eloChange); database.ref('users/' + loserUid + '/elo').set(losElo - eloChange);
    }
    database.ref('rooms/' + roomId).update(updates); updatePresence("online");
}

function backToMenu() { if(roomId) { database.ref('rooms/' + roomId).off(); database.ref(`rooms/${roomId}/chat`).off(); } clearInterval(timerInterval); roomId = null; myColor = null; gameData = {}; isInQueue = false; showMenu(); updatePresence("online"); }

function updateUI() {
    if (isGameOver) {
        document.getElementById('game-over-text').innerText = gameData.endMessage || "Koniec!";
        document.getElementById('elo-change-text').innerText = gameData.eloChangeMsg || "";
        document.getElementById('game-over-screen').style.display = 'flex';
    } else { document.getElementById('game-over-screen').style.display = 'none'; }

    const hasOpponent = gameData.players && gameData.players.white && gameData.players.black;
    document.getElementById('btn-draw').style.display = hasOpponent ? 'block' : 'none';
    if(gameData.drawOfferedBy && gameData.drawOfferedBy !== myColor && !isGameOver) document.getElementById('draw-modal').style.display = 'flex'; else document.getElementById('draw-modal').style.display = 'none';

    const btnAction = document.getElementById('btn-action');
    if (!hasOpponent) { btnAction.innerText = "Anuluj szukanie"; btnAction.style.background = "#d35400"; } else { btnAction.innerText = "Poddaj partię"; btnAction.style.background = "#c0392b"; }

    if(gameData.players) {
        const oppColor = myColor === 'white' ? 'black' : 'white'; const me = gameData.players[myColor], opp = gameData.players[oppColor];
        document.getElementById('my-name').innerText = me ? `${me.name} (${me.elo})` : "Ja";
        document.getElementById('opp-name').innerText = opp ? `${opp.name} (${opp.elo})` : "Oczekiwanie na gracza...";
        
        const defAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='%23555'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4h16s-1.9-4-8-4z'/></svg>";
        document.getElementById('my-avatar-img').src = (me && me.avatar) ? me.avatar : defAvatar;
        document.getElementById('opp-avatar-img').src = (opp && opp.avatar) ? opp.avatar : defAvatar;
    }

    const statusDiv = document.getElementById('status-panel');
    if(!hasOpponent) statusDiv.innerText = "Oczekiwanie na przeciwnika..."; else { statusDiv.innerText = currentTurn === myColor ? `TWÓJ RUCH` : `RUCH PRZECIWNIKA`; statusDiv.style.color = currentTurn === myColor ? "#81b64c" : "#aaa"; }

    document.getElementById('move-history').innerHTML = historyLog.map(l => `<div>${l}</div>`).join(''); document.getElementById('move-history').scrollTop = 9999;
    const boardDiv = document.getElementById('board'); boardDiv.innerHTML = '';
    const isBlackPerspective = (myColor === 'black'), wCheck = isKingInCheck('white', gameBoard), bCheck = isKingInCheck('black', gameBoard);

    for (let i = 0; i < 64; i++) {
        const r = isBlackPerspective ? Math.floor((63 - i) / 8) : Math.floor(i / 8), c = isBlackPerspective ? (63 - i) % 8 : i % 8;
        const square = document.createElement('div'); square.classList.add('square', (r + c) % 2 === 0 ? 'white-square' : 'black-square');
        if (selectedSquare && selectedSquare.row === r && selectedSquare.col === c) square.classList.add('selected');
        if (lastMove && ((lastMove.from.row === r && lastMove.from.col === c) || (lastMove.to.row === r && lastMove.to.col === c))) square.classList.add('last-move');
        const pieceStr = gameBoard[r][c];
        if (pieceStr === 'w_photo6' && wCheck) square.classList.add('in-check'); if (pieceStr === 'b_photo6' && bCheck) square.classList.add('in-check');

        if (pieceStr) {
            const container = document.createElement('div'); container.className = 'piece-container';
            const label = document.createElement('div'); label.className = 'piece-owner ' + (pieceStr.startsWith('w_') ? 'owner-white' : 'owner-black');
            label.innerText = getPieceName(pieceStr);
            
            const img = document.createElement('img'); 
            // NOWOŚĆ: Dynamiczne pobieranie źródła grafiki (klasyczne lub photo9-14)
            img.src = getPieceImgSrc(pieceStr); 
            img.classList.add('piece');
            if (pieceStr.startsWith('b_')) img.classList.add('piece-black');
            
            container.appendChild(label); container.appendChild(img); square.appendChild(container);
        }
        if (validMoves.find(m => m.row === r && m.col === c)) {
            const hintDiv = document.createElement('div'); hintDiv.className = pieceStr ? 'hint-capture' : 'hint'; square.appendChild(hintDiv);
        }
        square.onclick = () => handleSquareClick(r, c); boardDiv.appendChild(square);
    }
}
