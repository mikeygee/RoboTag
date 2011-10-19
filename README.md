# RoboTag

RoboTag is a head-to-head AI strategy game for programmers. You compete by programming a virtual robot to play a game of tag. Your robot's strategy is implemented in a Javascript function. The rules are simple, but creating a good strategy can be challenging.

## How it works
### Summary
The game begins with two robots placed on opposite corners of a **100 x 100** square arena. Each robot begins with **1000** units of fuel. Fuel is required to move your robot. Scattered throughout the arena are fuel tanks and mines. Picking up a fuel tank adds to your fuel, while hitting a mine subtracts from it. The object of the game is to tag your opponent when you have more fuel.

### Basic rules
*   The game has a maximum of **1000** turns. On each turn, both robots are required to submit a move.
*   The strategy of your robot is implemented in a Javascript function named `move`. This function is called once per turn, and must return an object with two values `dx` and `dy`, describing your move in the horizontal and vertical direction respectively. There are 3 parameters given to your function that will help you decide where to move. These are described in the next section.
*   Moves are limited to **3** units in each direction. Positive dx/dy values move right/up. Negative dx/dy values move left/down. The lower left corner of the arena maps to (x,y) = (0,0). The upper right corner is (x,y) = (100,100).
*   The amount of fuel used in each move = **dx<sup>2</sup> + dy<sup>2</sup> + 2**
*   A robot can hold a maximum of **1500** units of fuel.
*   A tag occurs when the robots are located within **5** units of distance of each other. The game ends, and the robot with more fuel wins. If the robots have the same amount of fuel, the game is ruled a tie.
*   A fuel tank is picked up, or a mine hit, when a robot is within **2** units of distance of the item.
*   Reminder: Distance formula &rarr; d = sqrt[(x<sub>1</sub> - x<sub>2</sub>)<sup>2</sup> + (y<sub>1</sub> - y<sub>2</sub>)<sup>2</sup>]
*   If time expires (1000 turns without a tag) or both robots run out of fuel, the game ends and is ruled a tie.

### Function parameters
There are 3 parameters provided to your function that represent the state of the game on any given turn. 

`function move(my, enemy, map) { ... return {dx: yourMove.x, dy: yourMove.y}; }`

1.   `my` - your robot
   *   `x`: the horizontal coordinate of your current position
   *   `y`: the vertical coordinate of your current position
   *   `fuel`: your current fuel amount
2.   `enemy` - your opponent
   *   `x`: the horizontal coordinate of your opponent's current position
   *   `y`: the vertical coordinate of your opponent's current position
   *   `fuel`: your opponent's current fuel amount
3.   `map` - contains the locations and values of untaken fuel tanks and mines
   *   `fuelTanks`: an array of fuel tank objects. Each fuel tank has the following properties:
      *   `x`: the horizontal coordinate of the fuel tank's location
      *   `y`: the vertical coordinate of the fuel tank's location
      *   `value`: the amount of fuel added if picked up 
   *   `mines`: an array of mine objects. Each mine object has the following properties:
      *   `x`: the horizontal coordinate of the mine's location
      *   `y`: the vertical coordinate of the mine's location
      *   `value`: the amount of fuel subtracted if hit

### Other details
*   The general flow of the game is as follows:
   1.   Call both robots' `move` functions
   2.   Move both robots and subtract fuel
   3.   Check for a tag. If yes, game is over.
   4.   Check for fuel tank pickups and mine hits and update fuel totals.
   5.   Check if time is expired (1000 turns) or if both robots are out of fuel. If yes, game is over.
   6.   Repeat
*   Note that both robots are moved before checking for a tag, and a tag takes precedence over a fuel pickup if both occur on the same turn.
*   If a robot tries to move past a wall, it will still lose fuel according to the returned move, but remain positioned at the border of the arena.
*   If your function does not return the expected `dx` and `dy` with numeric values between -3 and 3, or if any run time errors occur when calling your function, the match will end with no winner. The error message will be saved for reference.

## Try It 
RoboTag is easy to try without any kind of sign up or commitment. Individual matches can be run on the game page. A browser with Canvas support and Javascript is required. I have done basic testing in the latest versions of Firefox, Chrome, Safari, Opera, and IE9.

Link to game page: <http://mikeygee.github.com/RoboTag/play>

The game page consists of two text editors for submitting each robot's `move` function, and a canvas for viewing matches.

The easiest way to get started is to pick two sample robots and watch a match. The samples are meant to demonstrate how the function return value translates to movement. Hungry Bot is the most interesting sample and a good example of a basic strategy. Once you have a feel for how the game works and how the strategy is implemented in the function, try writing your own function. It can be challenging to think of and implement a good strategy, so start simple and incrementally improve on your strategy. We actually haven't written many robots ourselves and are curious to see what people come up with!

### Step 1: Code
For each of the two required robots, you have the choice of writing your own `move` function, or choosing a sample from the drop down selector. You can use your preferred text editor and copy/paste your function. Sample robots cannot be modified and are automatically submitted when selected. If there are any errors detected when submitting your function, a notice will appear above the text editor.

### Step 2: Watch
As soon as two valid robots are submitted, the view will shift to the canvas where you can watch a match between the two robots. Press the play button located underneath the canvas to start playback of the match. You can also use the slider control to browse turn by turn.

You can run additional matches using the buttons beneath the playback controls. **Swap** will run a match on the same map with starting positions swapped. **Rematch** will run a new match with a new map. **Play 10 matches** will silently play 10 matches (5 maps, 2 matches each from both start configurations) and provide summarized results. At any time, you can modify code or choose another sample bot in the code section.

You can modify the quantity of fuel tanks and mines using the drop down selectors underneath the canvas (effective for next match). You can show/hide various visual elements using the display menu on the lower left.

### Still To Do
Server side development. End goal is to have a complete web app where you can save your robots and enter them into tournaments to compete against other people.

## FAQ
**Q: How do I move my robot?** <br>
A: The return value of your function determines your move. It is passed back to the game code, which will update your position for you. For example, a return value of {dx: 2, dy: 1} would move your robot 2 units to the right and 1 unit up from your current position.

**Q: How do I pick up a fuel tank?**<br>
A: Move to within 2 units of distance of the fuel tank. Fuel tanks are automatically picked up when you move next to them. If you do not want to pick up the tank on a given turn, stay more than 2 units away. The only robot action possible in the context of the game is moving.

**Q: How can I save variables across turns?**<br>
A: The function parameters only give a current snapshot, meaning your robot is memoryless by default. However, you may save additional variables as members of the parameter objects, and they will persist across turns. For example, if you wanted to know how many turns have been played, you could do something like `my.turn = (typeof(my.turn) == "undefined") ? 0 : ++my.turn;`

**Q: How can I debug my function?**<br>
A: The game page is all client-side Javascript. Run time errors and function parameters at time of error can be seen by clicking the red error notification. [Firebug][] on Firefox and [Chrome Developer Tools][] have good Javascript debuggers. Before submitting your robot, set a breakpoint in the robotag.js file when `p1.move()` and/or `p2.move` are called (currently lines 252 and 263). Then you can step through your code, and set up additional breakpoints.

**Q: Are there any limits on the size of the `move` function?**<br>
A: You can use as many variables and sub functions as you need, but the run time will need to be reasonable, otherwise the browser will hang.

## About
The idea for this project came from a friend who teaches a programming course at UC Berkeley. He used this game for a class project, and it was very popular with students. I decided to make a web based version of the game as a personal exercise in web development, and also to make it more accessible to people that may enjoy it.

The problem with many programming assignments is that they are either boring with the end result being some text printed to a console, or they involve complex theoretical problems that few people have interest in. Likewise with programming competitions, they are often too difficult for less advanced programmers or have other barriers to entry. We believe that this game addresses some of these issues. The game is a simple, open ended problem that allows competitors to be creative in designing and implementing a strategy, and the entire strategy is contained in a standard function. With Javascript, everything is done right in the browser, and you get immediate visual feedback, as the strategy comes to life on the screen. It works well as a class project, a programming competition, or just a friendly game between coders.

RoboTag makes use of some great open source javascript libraries ([ACE][] text editor, [jquery][], and [Underscore][]). Many thanks and credits to the authors.

[Firebug]: http://getfirebug.com
[Chrome Developer Tools]: http://code.google.com/chrome/devtools/docs/scripts
[ACE]: https://github.com/ajaxorg/ace
[jquery]: http://jquery.com
[Underscore]: http://documentcloud.github.com/underscore
