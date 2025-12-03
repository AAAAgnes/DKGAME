// server/index.js (최종 버전: 채팅 기능 추가 및 오류 수정 완료)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'client')));


const server = http.createServer(app);

app.get('/', (req, res) => {
    // client 폴더 안에 있는 index.html 파일을 전송하도록 설정
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// 🚨 게임 설정 값
const GAME_PASSWORD = "dksex"; // 친구 전용 공통 비밀번호
const MAX_PLAYERS = 4;       // 최대 플레이어 수
const HAND_SIZE = 5;         // 시작 손패 수

// 🚨 배열을 무작위로 섞는 Fisher-Yates 알고리즘 함수
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

// **1. 카드 데이터 정의 (공/수 통합)**
const DECK_JOB = [
    { id: 1, name: '경호원', description: '상대를 그림자처럼 지키는 냉철한 무인.' },
    { id: 2, name: '아이돌', description: '화려한 무대 뒤, 고독과 비밀을 가진 스타.' },
    { id: 3, name: '배우', description: '가면 속에 자신을 숨긴, 연기에 집착하는 인물.' },
    { id: 4, name: '교수님', description: '지적이고 엄격한 권위, 연구실의 지배자.' },
    { id: 5, name: '의사', description: '생명을 다루는 예민함과 압도적인 통제력.' },
    { id: 6, name: '군인', description: '절제된 감정, 오직 명령에만 복종하는 전사.' },
    { id: 7, name: '형사', description: '정의를 쫓는 열혈, 혹은 냉정한 사냥꾼.' },
    { id: 8, name: '소방관', description: '위험 속에서 타인을 구하는 헌신적인 영웅.' },
    { id: 9, name: '사서', description: '고요한 공간 속, 지식과 비밀을 간직한 은둔자.' },
    { id: 10, name: '탐정', description: '날카로운 관찰력으로 숨겨진 진실을 파헤치는 자.' },
    { id: 11, name: '매니저', description: '가장 가까이에서 상대를 보필하는 능력자.' },
    { id: 12, name: '셰프', description: '완벽함을 추구하는 장인, 섬세한 손길의 미식가.' },
    { id: 13, name: '바텐더', description: '밤의 공간을 지배하며 익명의 이야기를 듣는 자.' },
    { id: 14, name: '타투이스트', description: '상대의 몸에 영원한 흔적을 새기는 예술가.' },
    { id: 15, name: '재벌 3세', description: '모든 것을 가졌지만, 채워지지 않는 권태감.' },
    { id: 16, name: '변호사', description: '논리와 언변의 달인, 차가운 이성의 소유자.' },
    { id: 17, name: '간호사', description: '돌봄과 치유의 손길, 희생정신.' },
    { id: 18, name: '집사', description: '주인을 그림자처럼 보좌하는 완벽한 헌신.' },
    { id: 19, name: '작가', description: '현실과 판타지를 넘나드는 섬세한 감성의 소유자.' },
    { id: 20, name: '프로게이머', description: '치열한 승부욕, 가상 세계의 영웅.' },
    { id: 21, name: '방송국 PD', description: '권력과 바쁜 일상, 카메라 뒤의 리더.' },
    { id: 22, name: '웹툰 작가', description: '마감을 쫓는 은둔형 크리에이터.' },
    { id: 23, name: '조폭 보스', description: '어둠의 세계를 지배하는 절대적인 권력.' },
    { id: 24, name: 'BJ', description: '대중의 관심 속에 사는, 가면 뒤의 진실.' },
    { id: 25, name: '재벌가 도련님', description: '온실 속의 화초처럼 세상 물정 모르는 순진함.' },
    { id: 26, name: '카센터 사장', description: '거칠고 투박하지만, 뜨거운 심장의 소유자.' },
    { id: 27, name: '카페 사장', description: '나른하고 여유로운 분위기, 비밀을 간직한 자.' },
    { id: 28, name: '패션 모델', description: '완벽한 외모와 몸매, 시선의 중심에 선 자.' },
    { id: 29, name: '회사원', description: '지친 일상 속, 잃어버린 꿈을 간직한 어른.' },
    { id: 30, name: '도예가', description: '느림의 미학, 흙을 만지는 고독한 예술가.' },
    { id: 31, name: '파티시에', description: '달콤함 속에 감춘 쓴맛, 섬세하고 까다로운 성격.' },
    { id: 32, name: '건축가', description: '이상과 현실을 설계하는, 창조의 전문가.' },
    { id: 33, name: '엔지니어', description: '논리적이고 이성적이지만, 깊게 빠지는 타입.' },
    { id: 34, name: '호스트', description: '밤의 화려함을 연기하는, 가짜 감정의 전문가.' },
    { id: 35, name: '퇴마사', description: '인간이 아닌 것을 보는, 영적인 능력의 소유자.' },
    { id: 36, name: '고고학자', description: '과거의 유물에 집착하는, 시간여행자 같은 학자.' },
    { id: 37, name: '학교선생님', description: '책임감과 학생에 대한 애정, 공과 사의 경계.' },
    { id: 38, name: '스포츠 선수', description: '젊은 피의 열정과 승리를 향한 집념.' },
    { id: 39, name: '유튜버', description: '끊임없이 새로운 콘텐츠를 찾아다니는 크리에이터.' },
    { id: 40, name: '보디가드', description: '임무에 충실한 방패, 드러나지 않는 감정.' },
    // ---------------------- 관계성/단일 설정 키워드 (41-80) ----------------------
    { id: 41, name: '소꿉친구', description: '가장 익숙한, 하지만 그래서 더 복잡한 관계.' },
    { id: 42, name: '학교 선배', description: '의지할 수 있는 존재이자, 때로는 넘을 수 없는 벽.' },
    { id: 43, name: '학교 후배', description: '항상 밝은 에너지로 다가오는, 지켜주고 싶은 존재.' },
    { id: 44, name: '짝사랑 상대', description: '나만 아는 감정, 일방적인 애틋함.' },
    { id: 45, name: '직장 상사', description: '권위를 가진 리더, 공과 사의 미묘한 경계.' },
    { id: 46, name: '룸메이트', description: '사적인 공간을 공유하는 데서 오는 친밀함.' },
    { id: 47, name: '입양 형제', description: '법적으로 형제, 혈연을 뛰어넘는 감정의 금기.' },
    { id: 48, name: '스승', description: '가르침을 주는 멘토, 존경과 욕망 사이.' },
    { id: 49, name: '형사', description: '돈, 복수 등 목적이 있는 기간 한정 관계의 상대.' },
    { id: 50, name: '정혼자', description: '어릴 적부터 묶인 운명, 짊어져야 할 무게.' },
    { id: 51, name: '하룻밤 상대', description: '충동적인 만남 후, 잊으려 했지만 잊을 수 없는 인연.' },
    { id: 52, name: '주인', description: '복종과 명령을 내리는, 절대적인 권력의 소유자.' },
    { id: 53, name: '은인', description: '나를 절망에서 구해준, 보답해야 할 존재.' },
    { id: 54, name: '복수 대상', description: '증오로 시작되지만, 시간이 갈수록 흔들리는 감정의 대상.' },
    { id: 55, name: '피보호자', description: '일방적인 보호와 의존, 헌신적인 사랑을 받는 존재.' },
    { id: 56, name: '채무자', description: '금전적인 빚을 져서 자유롭지 못한 존재.' },
    { id: 57, name: '외국인 유학생', description: '문화적 차이, 언어 장벽 속의 순수함.' },
    { id: 58, name: '환자', description: '폐쇄적인 공간, 의무와 복종의 상하 관계.' },
    { id: 59, name: '아버지의 친구', description: '나이 차이가 주는 긴장감과 금단의 매력.' },
    { id: 60, name: '악마', description: '짝사랑 상대를 대신하여 마음이 가는 존재.' },
    { id: 61, name: '천사', description: '종족을 초월한 금단의 사랑의 대상.' },
    { id: 62, name: '오메가', description: '본능과 계급이 지배하는 세계관의 피지배층.' },
    { id: 63, name: '알파', description: '지배적인 본능과 권위를 가진 세계관의 지배층.' },
    { id: 64, name: '센티넬', description: '특별한 능력을 매개로 맺어지는 숙명적인 관계의 능력자.' },
    { id: 65, name: '가이드', description: '센티넬의 폭주를 막는 치유의 손길.' },
    { id: 66, name: '스폰서', description: '물질적인 지원을 해주는, 그림자 속의 후원자.' },
    { id: 67, name: '부모님의 원수', description: '사랑해서는 안 되는, 복잡하게 얽힌 운명.' },
    { id: 68, name: '어린 시절 잊은 친구', description: '기억하지 못하는 유년 시절의 특별한 인연.' },
    { id: 69, name: '미성년자 (학생)', description: '사회적 금기, 순수함과 위험의 경계.' },
    { id: 70, name: '소속사 대표', description: '꿈과 성공을 쥐고 흔드는, 권력의 정점.' },
    { id: 71, name: '전 남자친구', description: '헤어졌지만 끊어지지 않은, 과거의 인연.' },
    { id: 72, name: '옆집 남자', description: '가장 가까우면서도 가장 사적인 이웃.' },
    { id: 73, name: '친절한 가게 주인', description: '일상의 위로를 주는, 다정한 미소의 소유자.' },
    { id: 74, name: '재활 치료사', description: '몸과 마음의 상처를 치유하는 전문가.' },
    { id: 75, name: '해커/정보상', description: '어둠의 정보를 다루는, 신비하고 위험한 존재.' },
    { id: 76, name: '사고뭉치', description: '끊임없이 사건을 일으켜 주변을 곤란하게 하는 자.' },
    { id: 77, name: '집착하는 스토커', description: '일방적인 관심으로 상대를 옥죄는 위험한 존재.' },
    { id: 78, name: '기자', description: '진실 혹은 거짓을 추격하는, 날카로운 시선의 전문가.' },
    { id: 79, name: '가정교사', description: '은밀하게 집으로 드나드는, 주종 관계의 전복자.' },
    { id: 80, name: '경쟁사 직원', description: '업무상 적이지만, 개인적으로 끌리는 관계.' },
];

// **2. Socket.io 서버 설정 (CORS 설정 필수)**
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// **3. 서버에 저장될 게임 상태 (G)**
let gameState = {
    isGameStarted: false,
    round: 0,
    message: "로비: 사원들을 기다리는 중...",
    currentPlayer: null,       // 현재 턴 플레이어의 socketId
    blGodId: null,             // 이번 라운드의 BL의 신의 socketId
    playerCount: 0,            // 플레이어 수 (관전자 제외)
    
    // 🚨 플레이어 목록 (소켓 ID 기반)
    players: {},               // { socketId: { id: 0, nickname: "xx", hand: [...], blScore: 0, popScore: 0 } }
    spectators: {},            // 관전자 목록
    
    deck: [],                  // 직업 카드 덱 (통합)
    tableCards: [],            // 테이블 위의 카드 (BL 카드만 저장)
    responseCards: [],         // 응답자들이 낸 카드
    votes: {},                 // { socketId: chosenCardId, ... } 투표 저장
    playerOrder: [],           // 게임 참여자들의 ID 순서 배열

    //라운드종료 대기플래그
    isRoundOver: false,

    // 🚨 채팅 로그 (최신 100개만 저장)
    chatLog: [],
};

// **4. 게임 초기화 함수 (로비 완료 후 호출)**
function initializeGame() {
    // 1. 덱 생성 및 셔플
    gameState.deck = shuffle([...DECK_JOB]); 
    
    // 2. 플레이어 순서 및 ID 할당
    gameState.playerOrder = Object.keys(gameState.players);
    
    // 3. 카드 분배 및 점수 초기화
    for (let socketId of gameState.playerOrder) {
        let player = gameState.players[socketId];
        player.hand = [];
        for (let i = 0; i < HAND_SIZE; i++) {
            player.hand.push(gameState.deck.pop());
        }
        player.blScore = 0;  // BL의 신 선택 점수 초기화
        player.popScore = 0; // 인기 투표 점수 초기화
    }

    gameState.isGameStarted = true;
    gameState.round = 0; 
    
    // 4. 첫 BL의 신 선정 및 턴 시작
    startNewRound(true); 
    
    console.log(`게임 시작! 사원 수: ${gameState.playerOrder.length}`);
}

function startNewRound(isInitial = false) {
    let nextBlGodIndex;
    
    if (isInitial) {
        // 첫 라운드는 0번 플레이어가 BL의 신
        nextBlGodIndex = 0;
    } else {
        // 다음 라운드는 순서대로 선정
        const currentBlGodIndex = gameState.playerOrder.findIndex(id => id === gameState.blGodId);
        nextBlGodIndex = (currentBlGodIndex + 1) % gameState.playerOrder.length;
    }

    // 다음 BL의 신 ID를 설정
    gameState.blGodId = gameState.playerOrder[nextBlGodIndex]; 
    gameState.currentPlayer = gameState.blGodId; // BL의 신이 먼저 카드를 내야 함
    gameState.tableCards = []; 
    gameState.responseCards = []; 
    gameState.votes = {}; // 투표 초기화

    // 🚨 [추가] 라운드 종료 상태 초기화
    gameState.isRoundOver = false; 

    gameState.message = `[${gameState.players[gameState.blGodId].nickname}] 부장이 담당자! 대영/리쿠를 정해 안건을 제출해주세요.`;
    gameState.round++;
}

// **5. 클라이언트 접속 처리 및 이벤트 정의**
io.on('connection', (socket) => {
    console.log('새로운 소켓 접속:', socket.id);

    // 🚨 로비 참여 이벤트
    socket.on('joinLobby', ({ nickname, password }) => {
        
        let isPlayer = (password === GAME_PASSWORD) && (gameState.playerCount < MAX_PLAYERS);
        
        if (isPlayer) {
            // 플레이어로 등록
            gameState.players[socket.id] = {
                id: gameState.playerOrder.length, // ID 할당
                nickname: nickname,
                socketId: socket.id,
                isPlayer: true,
                hand: [],
                blScore: 0, // 점수 초기화
                popScore: 0, // 점수 초기화
            };
            
            socket.emit('joined', { role: 'player' });
            console.log(`사원 접속: ${nickname} (현재 ${gameState.playerCount + 1}/${MAX_PLAYERS}명)`);
            gameState.playerCount++;

        } else {
            // 관전자로 등록
            gameState.spectators[socket.id] = { nickname: nickname, socketId: socket.id };
            
            socket.emit('joined', { role: 'spectator' });
            console.log(`관전자 접속: ${nickname}`);
        }
        
        emitGameState();
    });
    
    // 🚨 테스트용 게임 시작 버튼
    socket.on('startGame', () => {
        if (!gameState.isGameStarted && gameState.playerCount >= 2) {
            initializeGame();
            emitGameState();
        } else if (gameState.isGameStarted) {
             socket.emit('alert', '이미 회의가 시작되었습니다.');
        } else {
             socket.emit('alert', '최소 2명 이상의 사원이 필요합니다.');
        }
    });

    // 7. 클라이언트가 'playCard' 이벤트를 보낼 때 처리
    socket.on('playCard', ({ cardId, position }) => { 
        
        const playerId = socket.id; // 현재 이벤트를 보낸 소켓 ID
        const player = gameState.players[playerId]; // Active game player (null for spectator)
        const user = player || gameState.spectators[playerId]; // Any connected user

        // 1. 기본 체크 (사용자 접속 여부)
        if (!user) {
             socket.emit('alert', "접속 상태를 확인해주세요.");
             return;
        }

        // 🚨🚨🚨 BL 신의 '다음 라운드 시작' 요청 특별 처리
        if (!cardId && playerId === gameState.blGodId && gameState.isRoundOver === true) {
             startNewRound(false);
             emitGameState();
             return; // 다음 라운드 시작 후 즉시 종료
        }
        
        // 🚨 1.5. 투표 단계 처리 (응답 카드가 모두 제출된 후, BL의 신이 아닌 경우)
        if (gameState.responseCards.length === gameState.playerCount - 1 && playerId !== gameState.blGodId) {
            
            // 투표 처리 로직 (비순차적 투표 허용) - 관전자/플레이어 모두 허용
            if (gameState.votes[playerId]) {
                socket.emit('alert', "이미 투표했습니다.");
                emitGameState();
                return;
            }
            
            if (!cardId) {
                socket.emit('alert', "투표할 카드를 선택해야 합니다.");
                emitGameState();
                return;
            }
            
            const votedCardIndex = gameState.responseCards.findIndex(c => c.id === cardId);
            
            if (votedCardIndex === -1) {
                socket.emit('alert', "테이블 위의 카드에만 투표할 수 있습니다.");
                emitGameState();
                return;
            }
            
            // 투표 저장 (카드 ID)
            gameState.votes[playerId] = cardId;
            const nickname = player ? player.nickname : gameState.spectators[playerId].nickname;
            gameState.message = `[${nickname}] 님이 투표를 완료했습니다. (${Object.keys(gameState.votes).length}명 투표 완료)`;
            
            gameState.currentPlayer = gameState.blGodId; 
            
            emitGameState();
            return; // 투표 처리 후 종료
        }
        
        // --- 투표 단계가 아닌 경우, 또는 BL 신이 선택해야 하는 경우 ---
        
        // 2. 투표 단계 외 카드를 내는 행동은 플레이어만 가능 (관전자 차단)
        if (!player) {
             socket.emit('alert', "게임 조작은 부장님들만 할 수 있습니다.");
             return;
        }

        // 3. 턴 체크 (카드 제출 단계) 
        if (gameState.currentPlayer !== playerId && gameState.responseCards.length < gameState.playerCount - 1) {
            socket.emit('alert', "님 차례 아니라고요.");
            return;
        }
        
        // 카드가 제출된 경우에만 손패에서 제거 시도
        if (!cardId) {
             socket.emit('alert', "골라골라~.");
             return;
        }
        
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        let playedCard = null;

        if (cardIndex !== -1) {
             playedCard = player.hand.splice(cardIndex, 1)[0]; // 손패에서 제거
        } else if (playerId !== gameState.blGodId && gameState.tableCards.length > 0 && gameState.responseCards.length < gameState.playerCount - 1) {
             // 카드를 내는 플레이어인데 손패에 없는 카드를 냈다면 오류
             socket.emit('alert', "가지고 있는 카드를 고르셔야죠.");
             return;
        }
        
        
        // 🚨 4. BL의 신 카드 처리 (BL 카드만 테이블에 있는 경우)
        if (playerId === gameState.blGodId && gameState.tableCards.length === 0) {
            
            if (!position || (position !== 'Gong' && position !== 'Su')) {
                socket.emit('alert', "담당자는 대영이로 할지 리쿠로 할지 선택해야하셔요.");
                if(playedCard) player.hand.push(playedCard); // 카드 사용 취소
                emitGameState();
                return;
            }
            
            const blCard = {
                ...playedCard,
                position: position, 
                ownerId: playerId,
                ownerNickname: player.nickname 
            };
            
            gameState.tableCards = [blCard]; 
            // gameState.message = `[${player.nickname}] 담당자가 '${position}' 역할 결정! 이제 다른 부장님들의 차례.`;
            gameState.message = `[${player.nickname}] 담당자 결정완료!`;
            
            // 덱에서 카드 보충 (BL의 신)
            if (gameState.deck.length > 0) {
                player.hand.push(gameState.deck.pop());
            }

            // 턴 순서 결정 (BL의 신 다음 플레이어에게 턴을 넘김)
            const blGodIndex = gameState.playerOrder.indexOf(playerId);
            const nextPlayerIndex = (blGodIndex + 1) % gameState.playerOrder.length;
            gameState.currentPlayer = gameState.playerOrder[nextPlayerIndex];

        // 🚨 5. 응답자 카드 처리 (BL 카드가 테이블에 있고, 내가 BL의 신이 아닌 경우)
        } else if (playerId !== gameState.blGodId && gameState.tableCards.length > 0 && gameState.responseCards.length < gameState.playerCount - 1) {
            
            // 이미 카드를 냈는지 확인
            const alreadyPlayed = gameState.responseCards.some(card => card.ownerId === playerId);
            if (alreadyPlayed) {
                socket.emit('alert', "낙장불입 모르세요?");
                if(playedCard) player.hand.push(playedCard); 
                emitGameState();
                return;
            }
            
            const responseCard = {
                ...playedCard, 
                ownerId: playerId,
                ownerNickname: player.nickname, 
            };
            
            gameState.responseCards.push(responseCard); 
            gameState.message = `[${player.nickname}] 부장도 결정완료 (${gameState.responseCards.length}/${gameState.playerCount - 1})`;
            
            // 덱에서 카드 보충 (응답자)
            if (gameState.deck.length > 0) {
                player.hand.push(gameState.deck.pop());
            }

            // 5. 다음 턴 플레이어 선정 (순서대로)
            let currentPlayerIndex = gameState.playerOrder.indexOf(playerId);
            let nextPlayerId;

            do {
                currentPlayerIndex = (currentPlayerIndex + 1) % gameState.playerOrder.length;
                nextPlayerId = gameState.playerOrder[currentPlayerIndex];
            } while (nextPlayerId === gameState.blGodId && gameState.responseCards.length < gameState.playerCount - 1); 

            // 모든 응답자가 카드를 내지 않았다면 다음 응답자에게 턴을 넘김
            if (gameState.responseCards.length < gameState.playerCount - 1) {
                gameState.currentPlayer = nextPlayerId;
            } 
            
            // 🚨 6. 라운드 종료 체크 및 투표 단계 진입
            if (gameState.responseCards.length === gameState.playerCount - 1) {
                gameState.currentPlayer = gameState.blGodId; 
                gameState.message = `모든 의견 제출 완료! ${gameState.players[gameState.blGodId].nickname} 담당자의 선택을 기다리며, 모두 함께 투표타임.`;
            }
            playedCard = null; 

        // 🚨 7. BL의 신의 점수 카드 선택 처리 (투표/선택 단계에서만 작동)
        } else if (playerId === gameState.blGodId && gameState.responseCards.length === gameState.playerCount - 1) {
            
            const chosenCardIndex = gameState.responseCards.findIndex(c => c.id === cardId);
            
            if (chosenCardIndex === -1) {
                socket.emit('alert', "아 나머지중에 고르시라고요.");
                emitGameState();
                return;
            }

            const chosenCard = gameState.responseCards[chosenCardIndex];
            const winningPlayerId = chosenCard.ownerId; 
            
            // --- 🌟 복합 점수 계산 로직 🌟 ---
            gameState.players[winningPlayerId].blScore += 1;
            
            let maxVotes = 0;
            let popWinnerId = null;
            
            gameState.responseCards.forEach(card => {
                const cardId = card.id;
                const votesForCard = Object.values(gameState.votes).filter(votedCardId => votedCardId === cardId).length;
                
                if (votesForCard > maxVotes) {
                    maxVotes = votesForCard;
                    popWinnerId = card.ownerId; 
                } else if (votesForCard === maxVotes && maxVotes > 0) {
                    popWinnerId = null; 
                }
            });
            
            let popScoreMessage = '';

            if (popWinnerId && maxVotes > 0) {
                gameState.players[popWinnerId].popScore += 1;
                popScoreMessage = `(사원들의선택: [${gameState.players[popWinnerId].nickname}] 1점 획득, ${maxVotes}표)`;
            } else if (maxVotes > 0 && popWinnerId === null) {
                popScoreMessage = `(사원들의선택: 동점!! 아쉽다)`;
            } else {
                popScoreMessage = `(사원들의선택: 다들 어디가셨나요)`;
            }

            gameState.message = `
                [담당자 선택] : ${chosenCard.ownerNickname} 이 인사고과 1점을 획득했습니다!
                ${popScoreMessage}
                **담당자는 [다음 안건 시작] 버튼을 눌러주세요!**
            `;
            
            gameState.currentPlayer = playerId; 
            gameState.isRoundOver = true; 
            
            
        // 🚨 8. 잘못된 시도 또는 턴이 아닌 경우
        } else {
             if(playedCard) player.hand.push(playedCard); 
             socket.emit('alert', "님 차례 아니라긔윤");
             return;
        }
        
        emitGameState();
    });
    
    // 🚨🚨🚨 [이 부분에 위치해야 합니다!] 🚨🚨🚨
    // 9. 채팅 메시지 수신 이벤트
    socket.on('sendMessage', (message) => {
        const playerId = socket.id;
        const player = gameState.players[playerId];
        const user = player || gameState.spectators[playerId];

        if (!user || typeof message !== 'string' || message.trim().length === 0 || message.length > 200) {
            return;
        }

        const newMessage = {
            sender: user.nickname,
            text: message,
            timestamp: Date.now(),
            isPlayer: !!player, 
        };

        // 1. chatLog에 메시지 추가 (최신 100개 유지)
        gameState.chatLog.push(newMessage);
        if (gameState.chatLog.length > 100) {
            gameState.chatLog.shift(); // 오래된 메시지 삭제
        }

        // 2. 모든 접속자에게 메시지 전파
        io.emit('newChatMessage', newMessage);
    });
    
    // 6. 연결 해제 처리
    socket.on('disconnect', () => {
        if (gameState.players[socket.id]) {
            delete gameState.players[socket.id];
            gameState.playerCount--;
            console.log(`담당자 연결 해제: ${socket.id}`);
        } else if (gameState.spectators[socket.id]) {
            delete gameState.spectators[socket.id];
            console.log(`관전자 연결 해제: ${socket.id}`);
        }
        
        emitGameState();
    });
    // 🚨🚨🚨 [io.on('connection', ...)의 닫는 괄호] 🚨🚨🚨
});


// **7. 상태 전송 도우미 함수**
function emitGameState() {
    // 모든 접속자에게 최신 게임 상태 전송
    io.emit('gameStateUpdate', gameState); 
}

// **8. 서버 실행 (포트 3001)**
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.io 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});