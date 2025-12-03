// client/script.js (최종 버전: 라운드 종료 후 BL의 신 확인 버튼 기능 추가)

const socket = io('http://localhost:3001'); 

// 1. DOM 요소 가져오기
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const nicknameInput = document.getElementById('nickname-input');
const passwordInput = document.getElementById('password-input');
const joinButton = document.getElementById('join-button');
const lobbyStatus = document.getElementById('lobby-status');

// 게임 내부 요소
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const handContainerEl = document.getElementById('hand-container');
const tableContainerEl = document.getElementById('table-cards-list');
const tableCountEl = document.getElementById('table-cards-count');
const playerListUl = document.getElementById('player-list-ul');
const blGodNameEl = document.getElementById('bl-god-name');
const roundCountEl = document.getElementById('round-count');
const myHandTitleEl = document.getElementById('my-hand-title');

// 🚨 BL의 신 전용 요소
const blGodActionsEl = document.getElementById('bl-god-actions');
const cardToPlayNameEl = document.getElementById('card-to-play-name');
const playAsGongBtn = document.getElementById('play-as-gong');
const playAsSuBtn = document.getElementById('play-as-su');


let myRole = 'none'; // 'player' or 'spectator'
let mySocketId = socket.id; // 내 소켓 ID
let gameState = {}; // 현재 게임 상태 저장

// 2. 로비 참여 버튼 이벤트
joinButton.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    
    if (nickname.length === 0) {
        lobbyStatus.textContent = "닉네임을 입력해야 합니다.";
        return;
    }
    
    // 서버로 참여 요청 전송
    socket.emit('joinLobby', { nickname, password });
});

// 3. 서버로부터 로비 참여 결과 받기
socket.on('joined', ({ role }) => {
    myRole = role;
    lobbyContainer.style.display = 'none'; // 로비 숨기기
    gameContainer.style.display = 'block';  // 게임 화면 표시

    statusEl.textContent = `✅ 접속 성공. 당신의 역할: ${role === 'player' ? '담당자' : '사원'}`;

    if (role === 'spectator') {
        myHandTitleEl.textContent = '당신은 사원입니다. (안건 없음)';
        handContainerEl.innerHTML = '';
    } else {
        // 플레이어에게만 임시 시작 버튼 추가 (테스트용)
        const startBtn = document.createElement('button');
        startBtn.textContent = '회의 시작';
        startBtn.onclick = () => socket.emit('startGame');
        statusEl.appendChild(startBtn);
    }
});

// 4. 카드 HTML 생성 및 렌더링 함수
function renderHand(hand, blGodId) {
    handContainerEl.innerHTML = ''; 
    blGodActionsEl.style.display = 'none'; // 매 렌더링 시 버튼 UI 숨김
    
    // 🚨 [핵심 수정] BL의 신이 라운드 종료를 확인해야 하는 상태
    if (mySocketId === blGodId && gameState.isRoundOver) {
        // 모든 손패 카드를 감추고 다음 라운드 시작 버튼만 표시
        handContainerEl.textContent = '담당자: 회의 결과를 확인하고 다음 안건으로 ㄱㄱ.';
        
        // 버튼 텍스트 변경을 위한 임시 버튼 생성
        const nextRoundBtn = document.createElement('button');
        nextRoundBtn.textContent = '다음 안건 시작';
        nextRoundBtn.style.padding = '10px 20px';
        nextRoundBtn.style.fontSize = '1.2em';
        nextRoundBtn.style.cursor = 'pointer';
        
        nextRoundBtn.onclick = () => {
            // 서버에 다음 라운드 시작 요청 (cardId: null, position: null로 playCard 호출)
            socket.emit('playCard', { cardId: null, position: null }); 
        };
        
        handContainerEl.appendChild(nextRoundBtn);
        return; 
    }
    // ------------------------------------------

    if (!hand || hand.length === 0) {
        handContainerEl.textContent = '사업아이템이 비어 있습니다.';
        return;
    }
    
    // 🚨 중요: 버튼에 이전 클릭 이벤트의 잔재가 남지 않도록 새로운 요소를 만들고 대체합니다.
    const newPlayAsGongBtn = playAsGongBtn.cloneNode(true);
    const newPlayAsSuBtn = playAsSuBtn.cloneNode(true);

    playAsGongBtn.replaceWith(newPlayAsGongBtn);
    playAsSuBtn.replaceWith(newPlayAsSuBtn);
    
    // 새로 생성된 요소를 다시 변수에 할당합니다.
    const finalPlayAsGongBtn = document.getElementById('play-as-gong');
    const finalPlayAsSuBtn = document.getElementById('play-as-su');


    hand.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = `card`;
        
        // 카드 내용 설정
        cardEl.innerHTML = `
            <div class="card-type">직업</div>
            <div class="card-name">${card.name}</div>
        `;
        
        cardEl.dataset.cardId = card.id;

        // 🚨 카드 클릭 이벤트 리스너
        cardEl.addEventListener('click', () => {
            if (myRole !== 'player') return;
            if (!gameState.isGameStarted) return; 

            const cardId = card.id;
            const myPlayerIsGod = mySocketId === blGodId;
            const isMyTurn = mySocketId === gameState.currentPlayer;

            // 내 턴이 아니면 클릭 불가 (단, 투표 단계는 renderTable에서 처리)
            if (!isMyTurn && gameState.responseCards.length < gameState.playerCount - 1) {
                socket.emit('alert', "순서... 지켜주시죠?");
                return;
            }
            
            // --- 🚨 BL의 신일 때의 처리 ---
            if (myPlayerIsGod) {
                
                if (gameState.tableCards.length > 0 && gameState.responseCards.length < gameState.playerCount - 1) {
                    socket.emit('alert', "회의를 기다리세요.");
                    return;
                }
                
                if (gameState.responseCards.length >= gameState.playerCount - 1) {
                    // 투표가 완료되어 선택할 차례인 경우, 손패 카드를 클릭해도 무시
                    socket.emit('alert', "테이블에 있는 것중에 고르시라고요.");
                    return;
                }

                // 공/수 선택 UI 표시
                blGodActionsEl.style.display = 'block';
                cardToPlayNameEl.textContent = `선택된 직업: ${card.name}`;
                
                // --- 🌟 핵심 수정: 새로운 버튼에 클릭 리스너 연결 ---
                finalPlayAsGongBtn.onclick = () => {
                    // 서버로 'Gong' 타입으로 카드 사용 이벤트 전송
                    socket.emit('playCard', { cardId: cardId, position: 'Gong' });
                    blGodActionsEl.style.display = 'none';
                };
                
                finalPlayAsSuBtn.onclick = () => {
                    // 서버로 'Su' 타입으로 카드 사용 이벤트 전송
                    socket.emit('playCard', { cardId: cardId, position: 'Su' });
                    blGodActionsEl.style.display = 'none';
                };
                // --------------------------------------------------
                
            } else {
                // --- 🚨 응답자일 때의 처리 ---
                if (gameState.tableCards.length === 0) {
                    socket.emit('alert', "담당자의 결정을 기다리세요...");
                    return;
                }
                
                if (gameState.responseCards.length >= gameState.playerCount - 1) {
                    socket.emit('alert', "지금은 선택의 시간.");
                    return;
                }
                
                // 응답자 카드 사용 이벤트를 서버로 전송합니다.
                socket.emit('playCard', { cardId: cardId, position: null }); 
            }
        });

        handContainerEl.appendChild(cardEl);
    });
}

// 5. 테이블 카드 렌더링 함수
function renderTable(tableCards, responseCards) {
    tableContainerEl.innerHTML = ''; 
    const allCards = [...tableCards, ...responseCards]; 
    tableCountEl.textContent = `${allCards.length}`;
    
    const myPlayerIsGod = mySocketId === gameState.blGodId;
    
    // 🚨 투표 단계 조건
    const isVotingPhase = gameState.responseCards.length === gameState.playerCount - 1;
    
    // 🚨 BL의 신이 선택할 차례인지 확인 
    const isBlGodChoosing = isVotingPhase && myPlayerIsGod && gameState.currentPlayer === mySocketId && !gameState.isRoundOver;
    
    // 🚨 BL의 신이 아닌 모든 사람(응답자, 관전자)은 투표 단계에서 투표 가능 (비순차적 투표)
    const isVoter = isVotingPhase && !myPlayerIsGod && !gameState.isRoundOver;
    
    allCards.forEach(card => {
        const cardEl = document.createElement('div');
        
        let cardType = '아이템';
        let borderColor = '#87ceeb';
        let bgColor = '#f0f8ff';
        let footerText = `제출자: ${card.ownerNickname}`; 
        
        // 투표 표시
        const voteCount = Object.values(gameState.votes).filter(id => id === card.id).length;
        if (voteCount > 0) {
//             footerText += ` (투표 ${voteCount}표)`;
        }
        
        // BL 카드의 포지션에 따라 스타일을 부여합니다.
        if (card.position) { 
//             cardType = `이건 (${card.position})`;
            cardType = card.position === 'Gong' ? '대영' : '리쿠';
            borderColor = card.position === 'Gong' ? '#34a853' : '#ea4335';
            bgColor = card.position === 'Gong' ? '#e6f4ea' : '#fce8e6';
        } else if (card.ownerId) {
            cardType = '응답 카드';
            borderColor = '#333';
            bgColor = '#f8f8f8';
            
            // 🚨 투표/선택 단계에서 응답 카드에만 클릭 이벤트 추가
            if (isBlGodChoosing || isVoter) {
                cardEl.style.cursor = 'pointer';
                cardEl.classList.add('votable-card'); 

                // 나의 투표를 이미 완료했다면 카드 스타일 변경
                if (gameState.votes[mySocketId] === card.id) {
                    cardEl.style.borderWidth = '4px';
                    cardEl.style.borderColor = 'gold';
                    cardEl.style.boxShadow = '0 0 10px gold';
                    footerText += ' 👈 나의 투표';
                }
                
                cardEl.addEventListener('click', () => {
                    // BL 신이거나, 투표할 수 있는 사람만 클릭 가능
                    if (isBlGodChoosing || isVoter) {
                            // 투표는 손패 카드가 아니므로 cardId만 보냄 (position: null)
                            socket.emit('playCard', { cardId: card.id, position: null }); 
                    }
                });
            }
        }

        cardEl.className = `card`;
        cardEl.style.borderColor = borderColor;
        cardEl.style.backgroundColor = bgColor;
        cardEl.style.transform = 'scale(0.8)'; 
        
        if (!isBlGodChoosing && !isVoter) {
             cardEl.style.cursor = 'default';
        }
        
        // 🚨 [추가] 라운드 결과 발표 시 (isRoundOver = true) BL의 신이 선택한 카드 강조
        if (gameState.isRoundOver && gameState.responseCards.some(rc => rc.id === card.id && gameState.players[rc.ownerId].blScore > (gameState.round > 1 ? gameState.players[rc.ownerId].blScore - 1 : 0))) {
             cardEl.style.borderColor = '#008000'; // 녹색 테두리
             cardEl.style.boxShadow = '0 0 15px #008000';
             footerText += ' 🏆 담당자 선택!';
        }

        cardEl.innerHTML = `
            <div class="card-type">${cardType}</div>
            <div class="card-name">${card.name}</div>
            <div style="font-size: 10px; color: #666; margin-top: 5px;">${footerText}</div>
        `;

        tableContainerEl.appendChild(cardEl);
    });
}

function renderPlayerList(players, spectators) {
    playerListUl.innerHTML = '';
    
    // ⭐️ 수정: 플레이어 목록만 추출하여 순회합니다. (관전자 무시)
    const allPlayers = Object.values(players); 
    
    // 플레이어 순서대로 정렬 (playerOrder를 기준으로 정렬)
    const sortedPlayers = allPlayers.sort((a, b) => {
        const indexA = gameState.playerOrder.indexOf(a.socketId);
        const indexB = gameState.playerOrder.indexOf(b.socketId);
        return indexA - indexB;
    });

    // ⭐️ 이제 sortedPlayers (플레이어만 포함)를 순회합니다.
    for (const p of sortedPlayers) {
        
        const li = document.createElement('li');
        let statusText = '';
        
        // p는 이제 players 객체의 값 (player object)입니다.
        const isCurrentPlayer = p.socketId === gameState.currentPlayer && !gameState.isRoundOver;
        const isBlGod = p.socketId === gameState.blGodId;
        
        // 🚨 NEW: 점수 표시 수정 (총점, BL점수, 인기점수 분리)
        const blScore = p.blScore || 0;
        const popScore = p.popScore || 0;
        const totalScore = blScore + popScore;
        
        // 관전자 코드가 제거되었으므로, 이제 p는 항상 플레이어입니다.
        statusText = `(총점: ${totalScore}, 인사고과: ${blScore}, 인기도: ${popScore}) ${isBlGod ? '담당자' : ''} ${isCurrentPlayer ? '🟢 차례' : ''}`;
        
        li.textContent = `${p.nickname} ${statusText} ${p.socketId === mySocketId ? '👈 나' : ''}`;
        playerListUl.appendChild(li);
    }
    // 관전자를 표시하는 추가 로직도 제거되어 플레이어만 남게 됩니다.
}


// 7. 서버로부터 'gameStateUpdate'를 받을 때마다 화면 갱신
socket.on('gameStateUpdate', (newGameState) => {
    gameState = newGameState; // 상태 업데이트
    
    // BL 신일 경우 액션 숨기기 (BL 신이 카드를 냈을 때)
    if (newGameState.isGameStarted && newGameState.blGodId !== mySocketId) {
          blGodActionsEl.style.display = 'none';
    }


    messageEl.textContent = newGameState.message;
    roundCountEl.textContent = newGameState.round;

    // 접속자 목록 업데이트 (턴 정보 포함을 위해 gameState 필요)
    renderPlayerList(newGameState.players, newGameState.spectators);
    
    // BL의 신 이름 표시
    if (newGameState.blGodId && newGameState.players[newGameState.blGodId]) {
        blGodNameEl.textContent = newGameState.players[newGameState.blGodId].nickname;
    } else {
        blGodNameEl.textContent = '없음';
    }

    // 내 손패 렌더링 (플레이어인 경우에만)
    if (myRole === 'player') {
        const myPlayer = newGameState.players[mySocketId];
        if (myPlayer) {
            renderHand(myPlayer.hand, newGameState.blGodId);
        }
    }
    
    // 테이블 렌더링
    renderTable(newGameState.tableCards, newGameState.responseCards);
});

// 8. 기타 이벤트
socket.on('alert', (msg) => {
    alert(msg);
});
socket.on('connect', () => {
    // 소켓 ID가 변경될 경우 갱신
    mySocketId = socket.id;
});
socket.on('disconnect', () => {
    // 연결 끊김 처리
});


function sendChatMessage(text) {
    if (socket && text) {
        // 서버로 메시지 전송
        socket.emit('sendMessage', text);
        // 전송 후 입력창 비우기
        document.getElementById('chat-input').value = ''; 
    }
}

// [클라이언트 측 JavaScript]
socket.on('newChatMessage', (message) => {
    const chatContainer = document.getElementById('chat-messages');
    
    // 닉네임, 시간, 텍스트를 포함하는 HTML 요소 생성
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');
    
    // 플레이어/관전자에 따라 닉네임 색상 다르게 표시
    const senderClass = message.isPlayer ? 'player-nickname' : 'spectator-nickname';
    
    messageElement.innerHTML = `
        <span class="${senderClass}">[${message.sender}]</span>: 
        <span class="message-text">${message.text}</span>
    `;
    
    chatContainer.appendChild(messageElement);
    
    // 스크롤을 항상 최하단으로 이동
    chatContainer.scrollTop = chatContainer.scrollHeight;
});
// --- 채팅 DOM 요소 및 이벤트 리스너 추가 ---

// 1. 채팅 관련 DOM 요소 가져오기 (HTML에 이 ID가 있다고 가정)
const chatInput = document.getElementById('chat-input');
const chatSendButton = document.getElementById('chat-send-button');

// 2. '전송' 버튼 클릭 이벤트 리스너 연결
if (chatSendButton) {
    chatSendButton.addEventListener('click', () => {
        // 입력창의 현재 값을 가져와 sendChatMessage 함수에 전달
        sendChatMessage(chatInput.value);
    });
}

// 3. 'Enter' 키 입력 이벤트 리스너 연결
if (chatInput) {
    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Enter 키의 기본 동작 (예: 폼 제출) 방지
            sendChatMessage(chatInput.value);
        }
    });
}
