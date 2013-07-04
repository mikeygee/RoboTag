(function() {
'use strict';
var RoboTag = {};

// setup for use in both node and browser
if (typeof exports !== 'undefined') {
	exports = module.exports = RoboTag;
	var _ = require('underscore');
} else {
	window.RoboTag = RoboTag;
	var _ = window._;
}

_.deepClone = function(obj) {
	return _.isObject(obj) && JSON.parse(JSON.stringify(obj));
};

// models ------------------------------------

var Robot = RoboTag.Robot = function(options) {
	options = options || {};
	_.extend(this, options);
};

var User = RoboTag.User = function(options) {
	options = options || {};
	_.extend(this, options);
};

var Map = RoboTag.Map = function(options) {
	options = options || {};
	_.extend(this, options);
	_.defaults(this, {
		width: 100,
		height: 100,
		startPositions: [[25,25],[75,75]],
		fuelQty: 20,
		mineQty: 60,
		fuelValues: [50,100,150,200,250,300],
		mineValues: [50,100,150,200,250,300],
		fuelSpread: 10,
		mineSpread: 5,
		fuelTanks: [],
		mines: []
	});
	if(options.random)
		this.generateRandom();
};

_.extend(Map.prototype, {

	generateRandom: function() {

		function placeItems(items, qty, vals, threshold) {
			var x, y, val, dx, dy, distance, again = true, maxTries = 200;
			for(var i = 0; i < qty; i++) {
				while(again) {
					again = false;
					x = Math.random() * 100;
					y = Math.random() * 100;
					val = vals[Math.floor(Math.random()*vals.length)];
					for(var j = 0, len = items.length; j < len; j++) {
						dx = items[j].x - x;
						dy = items[j].y - y;
						distance = Math.sqrt(dx * dx + dy * dy);
						if(distance <= threshold) {
							again = true;
							break;
						}
					}
					if(!again) {
						for(var j = 0, len = this.startPositions.length; j < len; j++) {
							dx = this.startPositions[j][0] - x;
							dy = this.startPositions[j][1] - y;
							distance = Math.sqrt(dx*dx + dy*dy);
							if(distance <= threshold) {
								again = true;
								break;
							}
						}
					}
					if(--maxTries == 0)
						break;
				}
				items.push({x: x, y: y, value: val});
				again = true;
			}
		}

		this.fuelTanks = [];
		this.mines = [];
		placeItems.call(this, this.fuelTanks, this.fuelQty, this.fuelValues, this.fuelSpread);
		placeItems.call(this, this.mines, this.mineQty, this.mineValues, this.mineSpread);
	}

});

var Match = RoboTag.Match = function(options) {
	options = options || {};
	if(!options.p1 || !options.p2 || !options.map)
		throw new Error('Insufficient parameters for match: p1, p2, map required.');
	options.rules = options.rules || {};
	this.rules = _.defaults(options.rules, {
		maxTurns: 1000,
		maxMove: 3,
		tagThreshold: 5,
		fuelThreshold: 2,
		mineThreshold: 2,
		startFuel: 1000,
		maxFuel: 1500,
		ante: 2
	});
	_.extend(this, options, {
		moveLog: [],
		statLog: [],
		itemLog: [],
		turn: 0
	});
	this.p1stats = { x: this.map.startPositions[0][0], y: this.map.startPositions[0][1], fuel: this.rules.startFuel };
	this.p2stats = { x: this.map.startPositions[1][0], y: this.map.startPositions[1][1], fuel: this.rules.startFuel };
	this.mapStats = _.extend(_.clone(this.map), { fuelTanks: _.clone(this.map.fuelTanks), mines: _.clone(this.map.mines) });
	this.statLog.push([ _.clone(this.p1stats), _.clone(this.p2stats) ]);
};

_.extend(Match.prototype, {
	updatePosition : function(robot, move) {
		var fuelUsed = (move.dx * move.dx) + (move.dy * move.dy) + this.rules.ante;
		robot.fuel -= fuelUsed; // subtract fuel
		if(robot.fuel < 0) // if fuel drops below 0 from the move, set fuel to 0 and do not move
			robot.fuel = 0;
		else { // move the robot according to output
			robot.x += move.dx;
			robot.y += move.dy;
			if(robot.x > this.map.width)
				robot.x = this.map.width;
			if(robot.y > this.map.height)
				robot.y = this.map.height;
			if(robot.x < 0)
				robot.x = 0;
			if(robot.y < 0)
				robot.y = 0;
		}
	},
	itemCheck : function(robot) {
		var dx, dy, d;
		_.find(this.mapStats.fuelTanks, function(fuel, i, list) { // check for fuel hits
			dx = robot.x - fuel.x;
			dy = robot.y - fuel.y;
			d = Math.sqrt(dx * dx + dy * dy);
			if(d <= this.rules.fuelThreshold) {
				robot.fuel += fuel.value;
				if(robot.fuel > this.rules.maxFuel)
					robot.fuel = this.rules.maxFuel;
				this.itemLog.push({ turn: this.turn, fuel: _.indexOf(this.map.fuelTanks, fuel) });
				list.splice(i,1);
				return true;
			}
		}, this);
		_.find(this.mapStats.mines, function(mine, i, list) { // check for mine hits
			dx = robot.x - mine.x;
			dy = robot.y - mine.y;
			d = Math.sqrt(dx * dx + dy * dy);
			if(d <= this.rules.mineThreshold) {
				robot.fuel -= mine.value;
				if(robot.fuel < 0)
					robot.fuel = 0;
				this.itemLog.push({ turn: this.turn, mine: _.indexOf(this.map.mines, mine) });
				list.splice(i,1);
				return true;
			}
		}, this);
	},
	tagOccurred : function() {
		var dx = this.p2stats.x - this.p1stats.x;
		var dy = this.p2stats.y - this.p1stats.y;
		var distance = Math.sqrt(dx * dx + dy * dy);
		return (distance <= this.rules.tagThreshold);	
	},
	run : function() {
		if(!_.isFunction(this.p1.move) || !_.isFunction(this.p2.move))
			throw new Error('Functions not found. Cannot run match.');
		var m1, m2;
		while(true) {
			try {
				var c1 = _.clone(this.p1stats);
				var c2 = _.clone(this.p2stats);
				var cm = _.deepClone(this.mapStats);
				var start = Date.now();
				m1 = this.p1.move(c1, c2, cm);
				var end = Date.now();
				if(!_.isObject(m1) || !_.isNumber(m1.dx) || !_.isNumber(m1.dy))
					throw new Error('Move error. Expecting { dx: _, dy: _ }');
				else if(Math.sqrt(m1.dx * m1.dx + m1.dy * m1.dy) > this.rules.maxMove)
					throw new Error('Move error. Exceeded maximum move distance of ' + this.rules.maxMove + ' (d = ' + Math.sqrt(m1.dx * m1.dx + m1.dy * m1.dy) + ')');
				//if(end - start > 1000)
					//throw new Error('Move error. Time Limit exceeded. Function must return within 1 second');
			} catch(e) {
				this.result = {
					id: 'p1 error',
					description: e.message,
					winner: null
				}
				return this.result;
			}
			try {
				var c1 = _.clone(this.p1stats);
				var c2 = _.clone(this.p2stats);
				var cm = _.deepClone(this.mapStats);
				var start = Date.now();
				m2 = this.p2.move(c2, c1, cm);
				var end = Date.now();
				if(!_.isObject(m2) || !_.isNumber(m2.dx) || !_.isNumber(m2.dy))
					throw new Error('Move error. Expecting { dx: _, dy: _ }');
				else if(Math.sqrt(m2.dx * m2.dx + m2.dy * m2.dy) > this.rules.maxMove)
					throw new Error('Move error. Exceeded maximum move distance of ' + this.rules.maxMove + ' (d = ' + Math.sqrt(m2.dx * m2.dx + m2.dy * m2.dy) + ')');
				//if(end - start > 1000)
					//throw new Error('Move error. Time Limit Exceeded. Function must return within 1 second');
			} catch(e) {
				this.result = {
					id: 'p2 error',
					description: e.message + '\n' + e.message.indexOf('Move error') == 0 ? '' : e.stack,
					winner: null
				}
				return this.result;
			}

			this.updatePosition(this.p1stats, m1); // update positions
			this.updatePosition(this.p2stats, m2);
			this.turn++; // increment turn
			this.moveLog.push([ m1.dx, m1.dy, m2.dx, m2.dy ]); // log moves

			if(this.tagOccurred()) { // check for tag
				this.statLog.push([ _.clone(this.p1stats), _.clone(this.p2stats) ]); // log stats
				if(this.p1stats.fuel > this.p2stats.fuel)
					this.result = { id: 'tag', winner: 'p1' }
				else if(this.p1stats.fuel < this.p2stats.fuel)
					this.result = { id: 'tag', winner: 'p2' }
				else
					this.result = { id: 'tag', winner: null }
				return this.result;
			}

			this.itemCheck(this.p1stats); // check for item hits
			this.itemCheck(this.p2stats);

			this.statLog.push([ _.clone(this.p1stats), _.clone(this.p2stats) ]); // log stats

			if(this.p1stats.fuel <= 0 && this.p2stats.fuel <= 0) {
				this.result = { id: 'out of fuel', winner: null };
				return this.result;
			}

			if(this.turn >= this.rules.maxTurns) {
				this.result = { id: 'time expired', winner: null };
				return this.result;
			}
		}
	},
	runFromLog: function() { // rerun completed match to prepare for replay
		if(this.moveLog.length == 0)
			throw new Error('Cannot run match from empty log');
		this.p1stats = { x: this.map.startPositions[0][0], y: this.map.startPositions[0][1], fuel: this.rules.startFuel };
		this.p2stats = { x: this.map.startPositions[1][0], y: this.map.startPositions[1][1], fuel: this.rules.startFuel };
		this.mapStats = _.deepClone(this.map);
		this.itemLog = [];
		this.statLog = [[_.clone(this.p1stats), _.clone(this.p2stats)]];
		_.each(this.moveLog, function(move) {
			this.updatePosition(this.p1stats, move[0]);
			this.updatePosition(this.p2stats, move[1]);
			this.statLog.push([ _.clone(this.p1stats), _.clone(this.p2stats) ]);
			if(!this.tagOccurred()) {
				this.itemCheck(this.p1stats);
				this.itemCheck(this.p2stats);
			}
		}, this);
	}
});

var Tournament = RoboTag.Tournament = function(options) {
	options = options || {};
	_.extend(this, _.pick(options, ['date','name','robots','rules']));
};

_.extend(Tournament.prototype, {

});

})(this);
