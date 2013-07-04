# RoboTag

RoboTag is a head-to-head AI strategy game for programmers. You compete by programming a virtual robot to play a game of tag (a.k.a. predator/prey). Your robot's strategy is implemented in a Javascript function. The rules are simple, but creating a good strategy can be challenging.

## How it works
### Summary
The game begins with two robots placed on opposite corners of a **100 x 100** square arena. Each robot begins with **1000** units of fuel. Fuel is required to move your robot. Scattered throughout the arena are fuel tanks and mines. Picking up a fuel tank adds to your fuel, while hitting a mine subtracts from it. The object of the game is to tag your opponent when you have more fuel.

### Basic rules
*   The game has a maximum of **1000** turns. On each turn, both robots are required to submit a move.
*   The strategy of your robot is implemented in a Javascript function named `move`. This function is called once per turn, and must return an object with two values `dx` and `dy`, describing your move in the horizontal and vertical direction respectively. There are 3 parameters given to your function that will help you decide where to move. These are described in the next section.
*   Moves are limited to **3 units of distance** (i.e. sqrt(dx<sup>2</sup> + dy<sup>2</sup>) &lt;= 3), **NOT 3 units in each direction**. Positive dx/dy values move right/up. Negative dx/dy values move left/down. The lower left corner of the arena maps to (x,y) = (0,0). The upper right corner is (x,y) = (100,100).
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
*   If your function does not return the expected `dx` and `dy`, exceeds the movement limit of 3 units, or if any run time errors occur when calling your function, the match will end with no winner. The error message will be saved for reference.

## Try It 
RoboTag is easy to try out, no sign up required. Individual matches can be run on the demo page. A browser with canvas support and Javascript is required. I have done basic testing in the latest versions of Firefox, Chrome, Safari, Opera, and IE9+.

Link to demo: <http://mikeygee.github.com/RoboTag>

The demo consists of two text editors for submitting each robot's `move` function, and a canvas for viewing matches.

The easiest way to get started is to pick two sample robots and watch a match. The samples are meant to demonstrate how the function return value translates to movement. Hungry Bot is the most interesting sample and a good example of a basic strategy. Once you have a feel for how the game works, try writing your own function. It can be challenging to think of and implement a good strategy. We actually haven't written many robots ourselves and are curious to see what people come up with!

### Step 1: Code
For each of the two required robots, you have the choice of writing your own `move` function, or choosing a sample from the drop down menu. The editor has line wrap and Vim keymap options. When you are done coding, press the Submit button. If there are any errors detected when submitting your function, a notice will appear above the text editor. If not, the robot will show as ready. Two valid robots are required to start a match.

### Step 2: Watch
As soon as two valid robots are submitted, the view will shift to the canvas, and you'll see the animated match between the two robots. This gives you a nice visualization of the strategy you implemented in your function. You can click anywhere on the canvas or the bottom button to play/pause the match. You can also use the slider control to browse turn by turn.

On the left side, there is a control box for setting various options. The display options toggle various visual elements of the match. With the game options, you can modify the quantity of fuel tanks and mines (effective for the next match). The swap button will run a new match on the same map with the robots' starting positions switched. The rematch button will run a new match with a new map. 

At any time, you can modify code and resubmit to see a new match.

### Still To Do
Server side development is still in progress. The end goal is to have a complete web app where you can save your robots and enter them into tournaments to compete against other people. In the mean time, you can experiment with the demo and save your code on your own.

## FAQ
**Q: How do I move my robot?** <br>
A: The return value of your function determines your move. It is passed back to the game code, which will update your position for you. For example, a return value of `{ dx: 2, dy: 1 }` would move your robot 2 units to the right and 1 unit up from your current position.

**Q: How do I pick up a fuel tank?**<br>
A: Move to within 2 units of distance of the fuel tank. Fuel tanks are automatically picked up when you move next to them. If you do not want to pick up the tank on a given turn, stay more than 2 units away. The only robot action possible in the context of the game is moving.

**Q: How can I store historical data across turns?**<br>
A: The function parameters only give a current snapshot and local variables are lost once the function returns. This means your robot is memoryless by default. However, your function is attached to an object, so you can use the `this` keyword to save additional data to the object, and it will persist across turns. For example, if you wanted to know how many turns have been played, you could do something like `this.turn = (typeof(this.turn) == "undefined") ? 0 : ++this.turn;`

**Q: How can I debug my function?**<br>
A: Syntax errors will be shown above the code editing area if an invalid function is submitted. If run time errors occur during a match, they will be displayed as well. Since it's Javascript, you can run your function in a browser console, and pass it some test data. Or even better, most browsers have debuggers that will allow you to step through execution one line at a time and inspect data. There's always console.log too, but keep in mind the function will be called hundreds of times.

**Q: Are there any limits on the size of the `move` function?**<br>
A: You can use as many variables and sub functions as you need, but the run time will need to be reasonable. If the browser stalls for an extended period of time or hits memory limits, it is probably a sign you need to optimize your function or it's too complex.

## About
The idea for this project came from a friend who teaches a programming course at UC Berkeley. He used this game for a class project, and it was very popular with students. I decided to make a web based version of the game as a personal exercise in web development, and also to make it more accessible to people that may enjoy it.

Let's face it, most programming assignments in school aren't much fun. Likewise with programming competitions, they are often too difficult for less advanced programmers or have other barriers to entry. We believe that this game addresses some of these issues. The game is a simple, open ended problem that allows competitors to be creative in designing and implementing a strategy, and the entire strategy is contained in a standard function. With Javascript, everything is done right in the browser, and you get immediate visual feedback, as the strategy comes to life on the screen. It works well as a class project, a programming competition, or just a friendly game between coders.
