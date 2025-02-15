class GameLogic {
    cloneState(state) {
        return {
            player: state.player.slice(),
            ai: state.ai.slice(),
            turn: state.turn
        };
    }

    getPossibleMoves(state) {
        let moves = [];
        if (state.turn === "ai") {
            for (let i = 0; i < 2; i++) {
                if (state.ai[i] !== null) {
                    for (let j = 0; j < 2; j++) {
                        if (state.player[j] !== null) {
                            moves.push({ mover: "ai", ownIndex: i, oppIndex: j });
                        }
                    }
                }
            }
        } else {
            for (let i = 0; i < 2; i++) {
                if (state.player[i] !== null) {
                    for (let j = 0; j < 2; j++) {
                        if (state.ai[j] !== null) {
                            moves.push({ mover: "player", ownIndex: i, oppIndex: j });
                        }
                    }
                }
            }
        }
        return moves;
    }

    doMove(state, move) {
        let newState = this.cloneState(state);
        if (move.mover === "ai") {
            let x = newState.ai[move.ownIndex];
            let d = newState.player[move.oppIndex];
            let sum = x + d;
            let newNum = sum % 10;
            newState.ai[move.ownIndex] = (newNum === 0 ? null : newNum);
        } else {
            let x = newState.player[move.ownIndex];
            let d = newState.ai[move.oppIndex];
            let sum = x + d;
            let newNum = sum % 10;
            newState.player[move.ownIndex] = (newNum === 0 ? null : newNum);
        }
        newState.turn = (state.turn === "ai" ? "player" : "ai");
        return newState;
    }

    isTerminal(state) {
        const playerCount = state.player.filter(x => x !== null).length;
        const aiCount = state.ai.filter(x => x !== null).length;
        return (playerCount === 0 || aiCount === 0);
    }

    evaluate(state) {
        const playerCount = state.player.filter(x => x !== null).length;
        const aiCount = state.ai.filter(x => x !== null).length;
        if (aiCount === 0) return 10000; // AI获胜
        if (playerCount === 0) return -10000; // 玩家获胜
        let score = 0;
        score += (2 - aiCount) * 200;
        score -= (2 - playerCount) * 200;
        const sumArr = arr => arr.reduce((s, v) => s + (v === null ? 0 : v), 0);
        score += sumArr(state.ai) - sumArr(state.player);
        let aiImmediate = 0;
        for (let x of state.ai) {
            if (x !== null && state.player.some(d => d === (10 - x))) {
                aiImmediate++;
            }
        }
        let playerImmediate = 0;
        for (let x of state.player) {
            if (x !== null && state.ai.some(d => d === (10 - x))) {
                playerImmediate++;
            }
        }
        score += (aiImmediate - playerImmediate) * 150;
        return score;
    }

    minimax(state, depth, alpha, beta) {
        if (depth === 0 || this.isTerminal(state)) {
            return this.evaluate(state);
        }
        const moves = this.getPossibleMoves(state);
        if (state.turn === "ai") {
            let maxEval = -Infinity;
            for (let move of moves) {
                const newState = this.doMove(state, move);
                const evalVal = this.minimax(newState, depth - 1, alpha, beta);
                maxEval = Math.max(maxEval, evalVal);
                alpha = Math.max(alpha, evalVal);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let move of moves) {
                const newState = this.doMove(state, move);
                const evalVal = this.minimax(newState, depth - 1, alpha, beta);
                minEval = Math.min(minEval, evalVal);
                beta = Math.min(beta, evalVal);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    findBestMove(state, depth) {
        let bestScore = -Infinity;
        let bestMove = null;
        const possibleMoves = this.getPossibleMoves(state);
        for (let move of possibleMoves) {
            const newState = this.doMove(state, move);
            const score = this.minimax(newState, depth - 1, -Infinity, Infinity);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        return bestMove;
    }
}

const gameLogic = new GameLogic();

onmessage = function(event) {
    if (event.data.command === 'getBestMove') {
        const bestMove = gameLogic.findBestMove(event.data.state, event.data.depth);
        postMessage({ command: 'bestMove', bestMove: bestMove });
    }
};
