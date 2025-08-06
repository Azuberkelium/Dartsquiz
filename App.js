mport React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Heart, Target, Trophy, Timer, Volume2, VolumeX } from 'lucide-react';

const DARTBOARD_VALUES = [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  25,
  50,
];

const MULTIPLIERS = {
  single: 1,
  double: 2,
  triple: 3,
};

// Pre-compute all possible dart sums to ensure questions are always solvable.
const precomputePossibleSums = (doubleOut = false) => {
  const sums = new Set();
  const singles = DARTBOARD_VALUES;
  const doubles = DARTBOARD_VALUES.slice(0, 20).map(val => val * 2);
  const triples = DARTBOARD_VALUES.slice(0, 20).map(val => val * 3);
  const allHits = [...singles, ...doubles, ...triples];

  if (doubleOut) {
    const doublesAndBull = [...doubles, 50];
    for (const i of allHits) {
      for (const j of allHits) {
        for (const k of doublesAndBull) {
          sums.add(i + j + k);
        }
      }
    }
  } else {
    for (const i of allHits) {
      for (const j of allHits) {
        for (const k of allHits) {
          sums.add(i + j + k);
        }
      }
    }
  }
  return sums;
};

// Memoize the possible sums for efficiency.
const possibleSums = precomputePossibleSums();
const doubleOutSums = precomputePossibleSums(true);

const sfxCorrect = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
const sfxIncorrect = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3');
const sfxDartThrow = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3');
sfxCorrect.loop = false;
sfxIncorrect.loop = false;
sfxDartThrow.loop = false;

const App = () => {
  const [gameState, setGameState] = useState('menu'); // 'menu', 'playing', 'gameOver'
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [timer, setTimer] = useState(30);
  const [question, setQuestion] = useState('');
  const [targetSum, setTargetSum] = useState(0);
  const [dartsThrown, setDartsThrown] = useState([]);
  const [doubleOutMode, setDoubleOutMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const [animatedDarts, setAnimatedDarts] = useState([]);

  useEffect(() => {
    const storedHighScore = localStorage.getItem('zubi-maths-darts-quiz-high-score');
    if (storedHighScore) {
      setHighScore(parseInt(storedHighScore, 10));
    }
  }, []);

  const resetGame = () => {
    setScore(0);
    setLives(3);
    setConsecutiveCorrect(0);
    setDartsThrown([]);
    setAnimatedDarts([]); // Reset animated darts
    setGameState('playing');
    setTimer(30);
    generateQuestion();
  };

  const saveHighScore = useCallback(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('zubi-maths-darts-quiz-high-score', score.toString());
    }
  }, [score, highScore]);

  const generateQuestion = useCallback(() => {
    const sumsToCheck = doubleOutMode ? doubleOutSums : possibleSums;
    if (sumsToCheck.size === 0) {
      console.error("No possible sums available. Game cannot proceed.");
      return;
    }

    let a, b, op, result;
    let found = false;

    // Loop until a solvable question is found
    while (!found) {
      const ops = ['+', '-', '*', '/'];
      op = ops[Math.floor(Math.random() * ops.length)];
      a = Math.floor(Math.random() * 50) + 1;
      b = Math.floor(Math.random() * 50) + 1;

      switch (op) {
        case '+':
          result = a + b;
          break;
        case '-':
          result = a - b;
          break;
        case '*':
          a = Math.floor(Math.random() * 20) + 1;
          b = Math.floor(Math.random() * 20) + 1;
          result = a * b;
          break;
        case '/':
          // Ensure division results in a whole number
          a = (Math.floor(Math.random() * 10) + 1) * (Math.floor(Math.random() * 10) + 1);
          b = Math.floor(Math.random() * 10) + 1;
          while (a % b !== 0 || a === 0) {
            a = (Math.floor(Math.random() * 10) + 1) * (Math.floor(Math.random() * 10) + 1);
            b = Math.floor(Math.random() * 10) + 1;
          }
          result = a / b;
          break;
        default:
          break;
      }

      if (sumsToCheck.has(result)) {
        found = true;
      }
    }

    setQuestion(`${a} ${op} ${b}`);
    setTargetSum(result);
    setTimer(30);
    setDartsThrown([]);
    setAnimatedDarts([]); // Reset animated darts for new question
  }, [doubleOutMode]);

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleWrongAnswer();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [gameState]);

  const handleCorrectAnswer = useCallback(() => {
    if (!isMuted) sfxCorrect.play().catch(e => console.log('SFX play failed:', e));
    setScore((prev) => prev + 10);
    setConsecutiveCorrect((prev) => {
      const newConsecutive = prev + 1;
      if (newConsecutive >= 5) {
        setLives((prevLives) => prevLives + 1);
        return 0; // Reset consecutive counter
      }
      return newConsecutive;
    });
    generateQuestion();
    setAnimatedDarts([]); // Clear darts on correct answer
  }, [generateQuestion, isMuted]);

  const handleWrongAnswer = useCallback(() => {
    if (!isMuted) sfxIncorrect.play().catch(e => console.log('SFX play failed:', e));
    setLives((prev) => {
      const newLives = prev - 1;
      if (newLives <= 0) {
        saveHighScore();
        setGameState('gameOver');
      }
      return newLives;
    });
    setConsecutiveCorrect(0);
    generateQuestion();
    setAnimatedDarts([]); // Clear darts on wrong answer
  }, [generateQuestion, saveHighScore, isMuted]);

  const checkAnswer = useCallback((currentDarts) => {
    const sum = currentDarts.reduce((acc, val) => acc + val, 0);
    const lastDartValue = currentDarts[2];

    const isLastDouble = DARTBOARD_VALUES.slice(0, 20).some(val => val * 2 === lastDartValue) || lastDartValue === 50;
    
    if (sum === targetSum) {
      if (doubleOutMode) {
        if (isLastDouble) {
          handleCorrectAnswer();
        } else {
          // Double out rule not met
          handleWrongAnswer();
        }
      } else {
        handleCorrectAnswer();
      }
    } else {
      handleWrongAnswer();
    }
  }, [targetSum, doubleOutMode, handleCorrectAnswer, handleWrongAnswer]);

  const handleDartThrow = useCallback((value, x, y) => {
    if (dartsThrown.length < 3) {
      if (!isMuted) sfxDartThrow.play().catch(e => console.log('SFX play failed:', e));
      const newDarts = [...dartsThrown, value];
      setDartsThrown(newDarts);

      // Now we just add the dart and it stays
      setAnimatedDarts(prev => [...prev, { x, y, value }]);
    }
  }, [dartsThrown, isMuted]);

  const handleSubmit = useCallback(() => {
      if (dartsThrown.length === 3) {
          checkAnswer(dartsThrown);
      }
  }, [dartsThrown, checkAnswer]);

  const handleUndo = useCallback(() => {
      if (dartsThrown.length > 0) {
          setDartsThrown(dartsThrown.slice(0, -1));
          setAnimatedDarts(animatedDarts.slice(0, -1));
      }
  }, [dartsThrown, animatedDarts]);

  const handleMiss = useCallback(() => {
      if (dartsThrown.length < 3) {
          if (!isMuted) sfxDartThrow.play().catch(e => console.log('SFX play failed:', e));
          const newDarts = [...dartsThrown, 0];
          setDartsThrown(newDarts);
          // Add a dart visually outside the board
          setAnimatedDarts(prev => [...prev, { x: -100, y: -100, value: 0 }]);
      }
  }, [dartsThrown, isMuted]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Canvas drawing and event handling logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;

    const ctx = canvas.getContext('2d');
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.8;
    canvas.width = size;
    canvas.height = size;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2;

    const drawDartboard = () => {
      ctx.clearRect(0, 0, size, size);
      
      const doubleTripleRings = [
        // Double ring is wider
        { rInner: radius * 0.92, rOuter: radius, color: '#15803d', altColor: '#b91c1c', value: 'double' },
        { rInner: radius * 0.5, rOuter: radius * 0.6, color: '#b91c1c', altColor: '#15803d', value: 'triple' }
      ]

      // Correct segments for a standard dartboard layout
      const segments = [
        20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5
      ];

      let angle = -Math.PI / 20 - Math.PI / 2; // Starting angle to center 20 at the top

      for (let i = 0; i < 20; i++) {
        const startAngle = angle;
        const endAngle = startAngle + Math.PI / 10;
        const number = segments[i];

        // Draw the single beds
        // Single bed outer radius changed to match the new double ring inner radius
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.92, startAngle, endAngle);
        // The inner radius of the single bed is now larger to accommodate the bigger 25 ring
        ctx.arc(centerX, centerY, radius * 0.15, endAngle, startAngle, true);
        ctx.fillStyle = i % 2 === 0 ? '#013e28' : '#e5e7eb';
        ctx.fill();
        ctx.closePath();

        // Draw double and triple rings
        doubleTripleRings.forEach(ring => {
            ctx.beginPath();
            ctx.arc(centerX, centerY, ring.rOuter, startAngle, endAngle);
            ctx.arc(centerX, centerY, ring.rInner, endAngle, startAngle, true);
            ctx.fillStyle = i % 2 === 0 ? ring.color : ring.altColor;
            ctx.fill();
            ctx.closePath();
        });


        // Draw the number inside the single section
        const numberTextRadius = radius * 0.75;
        const numberTextX = centerX + numberTextRadius * Math.cos(startAngle + Math.PI / 20);
        const numberTextY = centerY + numberTextRadius * Math.sin(startAngle + Math.PI / 20);
        ctx.fillStyle = i % 2 === 0 ? '#e5e7eb' : '#013e28'; // Opposite color for contrast
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number.toString(), numberTextX, numberTextY);

        // Draw the number on the perimeter
        const perimeterTextRadius = radius * 1.05;
        const perimeterTextX = centerX + perimeterTextRadius * Math.cos(startAngle + Math.PI / 20);
        const perimeterTextY = centerY + perimeterTextRadius * Math.sin(startAngle + Math.PI / 20);
        ctx.fillStyle = '#fff';
        ctx.font = '24px Inter, sans-serif';
        ctx.fillText(number.toString(), perimeterTextX, perimeterTextY);

        angle += Math.PI / 10;
      }
      // Draw a larger outer bull (the 25 ring)
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.15, 0, 2 * Math.PI);
      ctx.fillStyle = '#15803d'; // Outer bull green
      ctx.fill();
      ctx.closePath();

      // Draw the bullseye
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.05, 0, 2 * Math.PI);
      ctx.fillStyle = '#b91c1c'; // Bullseye red
      ctx.fill();
      ctx.closePath();

      // Draw animated darts
      animatedDarts.forEach(dart => {
        ctx.beginPath();
        ctx.arc(dart.x, dart.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#3b82f6'; // Darts are now blue
        ctx.fill();
        ctx.closePath();
      });
    };

    const getDartValue = (x, y) => {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Bullseye
        if (dist < radius * 0.05) return 50;
        // Outer bull (now bigger)
        if (dist < radius * 0.15) return 25;

        // Angle and segment calculation for all other rings
        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += 2 * Math.PI;

        const startAngle = -Math.PI / 20 - Math.PI / 2;
        const angleAdjusted = (angle - startAngle + 2 * Math.PI) % (2 * Math.PI);
        const segmentIndex = Math.floor(angleAdjusted / (Math.PI / 10));
        
        // Correct segments for a standard dartboard layout
        const segmentNumbers = [
            20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5
        ];
        const value = segmentNumbers[segmentIndex];

        // Multiplier based on distance
        // The check for the double ring has been updated to match the new visual size
        if (dist > radius * 0.92 && dist < radius) {
            return value * MULTIPLIERS.double;
        } else if (dist > radius * 0.5 && dist < radius * 0.6) {
            return value * MULTIPLIERS.triple;
        } else {
            return value * MULTIPLIERS.single;
        }
    };

    const handleCanvasClick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const value = getDartValue(x, y);
        handleDartThrow(value, x, y);
    };

    const animationLoop = () => {
        drawDartboard();
        requestAnimationFrame(animationLoop);
    };
    
    // Initial draw and start animation loop
    drawDartboard();
    const animationFrameId = requestAnimationFrame(animationLoop);

    canvas.addEventListener('click', handleCanvasClick);
    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, handleDartThrow, animatedDarts]);

  const renderGameContent = () => {
    switch (gameState) {
      case 'menu':
        return (
          <div className="flex flex-col items-center space-y-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white text-center drop-shadow-lg">
              Zubi Maths Darts Quiz
            </h1>
            <p className="text-xl sm:text-2xl text-gray-200 text-center max-w-xl">
              Hit the right zones with 3 darts to get the answer!
            </p>
            <div className="flex flex-col items-center space-y-4">
              <button
                onClick={resetGame}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 text-lg sm:text-xl"
              >
                Start Game
              </button>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="doubleOut"
                  checked={doubleOutMode}
                  onChange={() => setDoubleOutMode(!doubleOutMode)}
                  className="h-5 w-5 text-purple-600 rounded"
                />
                <label htmlFor="doubleOut" className="text-white text-lg">
                  Double Out Mode
                </label>
              </div>
            </div>
          </div>
        );
      case 'playing':
        return (
          <div className="flex flex-col items-center space-y-6 w-full">
            <div className="flex justify-between items-center w-full px-4 sm:px-8">
              <div className="flex items-center space-x-2 text-white text-xl">
                <Target size={32} />
                <span className="font-bold">Score: {score}</span>
              </div>
              <div className="flex items-center space-x-2 text-red-400 text-xl">
                <Heart fill="currentColor" stroke="none" size={32} />
                <span className="font-bold">Lives: {lives}</span>
              </div>
              <div className="flex items-center space-x-2 text-yellow-300 text-xl">
                <Timer size={32} />
                <span className="font-bold">Time: {timer}s</span>
              </div>
              <button onClick={toggleMute} className="text-white">
                {isMuted ? <VolumeX size={32} /> : <Volume2 size={32} />}
              </button>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white text-center drop-shadow-md">
              {question} = ?
            </h2>
            <div className="text-xl text-white font-semibold">
                Darts Thrown: {dartsThrown.join(' + ')}
            </div>
            <div className="w-full flex justify-center p-4">
              <canvas ref={canvasRef} className="rounded-full shadow-2xl border-4 border-gray-900"></canvas>
            </div>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              {dartsThrown.length > 0 && (
                <button
                    onClick={handleUndo}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 text-lg"
                >
                    Undo
                </button>
              )}
              {dartsThrown.length < 3 && (
                <button
                    onClick={handleMiss}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 text-lg"
                >
                    Miss (0)
                </button>
              )}
              {dartsThrown.length === 3 && (
                  <button
                      onClick={handleSubmit}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 text-lg"
                  >
                      Submit Answer
                  </button>
              )}
            </div>
            {doubleOutMode && (
              <p className="text-red-400 font-bold text-lg">
                Double Out Mode: Last dart must be a double!
              </p>
            )}
          </div>
        );
      case 'gameOver':
        return (
          <div className="flex flex-col items-center space-y-6">
            <h1 className="text-5xl sm:text-6xl font-extrabold text-red-500 text-center drop-shadow-lg">
              Game Over!
            </h1>
            <p className="text-3xl sm:text-4xl text-white font-bold">
              Your Score: {score}
            </p>
            <p className="text-2xl sm:text-3xl text-yellow-300 flex items-center space-x-2 font-bold">
              <Trophy size={32} />
              <span>High Score: {highScore}</span>
            </p>
            <button
              onClick={resetGame}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 text-lg"
            >
              Play Again
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 font-inter text-white flex flex-col items-center justify-center p-4">
      {renderGameContent()}
    </div>
  );
};

export default App;
