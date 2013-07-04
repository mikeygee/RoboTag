(function(exports) {

var RoboTag = window.RoboTag || {};

var templateSettings = {
	interpolate : /\{\!([\s\S]+?)\}\}/g,
	escape : /\{\{([\s\S]+?)\}\}/g,
	variable: 'ctx'
};

RoboTag.CodeEditor = function(options) {
	options = options || {};
	_.bindAll(this);
	_.extend(this, options);
	var id = options.id || _.uniqueId();
	_.defaults(this, {
		container: document.createElement('div'),
		demo: true,
		robots: RoboTag.sampleBots, 
		fn: '/* Write your move function\n Function must return an object in the format { dx: Number, dy: Number }\n Total distance must be <= 3 i.e. sqrt(dx^2 + dy^2) <= 3\n Confused? Try a sample robot from the drop down menu below\n*/\nfunction move(my, enemy, map) {\n\t\n}',
		editorId: 'rt-editor' + id,
		className: 'p' + id,
		status: 'initial'
	});

	this.$el = $(this.container).html(this.template(this));
	this.$status = this.$('.status');
	this.editor = ace.edit(this.editorId);
	if(this.theme)
		this.editor.setTheme('ace/theme/' + this.theme);
	this.editor.getSession().setMode('ace/mode/javascript');
	this.editor.getSession().setUseWrapMode(true);
	this.editor.setShowPrintMargin(false);
	this.listen();

	return this;
};

_.extend(RoboTag.CodeEditor.prototype, {
	template : _.template($('#template-editor').html(), null, templateSettings),
	$ : function(s) { return this.$el.find(s); },
	listen : function() {
		var self = this;
		this.$el.on('change', '.rt-robot-select', this.load)
			.on('click', 'button.submit', this.saveDemo)
			.on('change', '#toggle-line-wrap', function(evt) {
				self.editor.getSession().setUseWrapMode($(this).prop('checked'));
			})
			.on('change', '#toggle-vim-mode', function(evt) {
				self.editor.setKeyboardHandler($(this).prop('checked') ? 'ace/keyboard/vim' : '');
			});

		this.editor.getSession().on('change', function(e) {
			if(self.status != 'edited' && self.status != 'error') {	
				self.status = 'edited';
				self.$status.attr('class','status').html(''); // clear status
			}
		});
	},
	load : function(evt) {
		var bot = $(evt.currentTarget).val();
		this.name = bot ? bot : 'Player ' + this.id;
		this.$('.name').html(this.name);
		this.editor.setValue(bot ? this.robots[bot] : this.fn);
		this.editor.clearSelection();
	},
	save : function() {

	},
	saveDemo : function() {
		try {
			var match = this.editor.getValue().match(/function\s+move\s*\(\s*my\s*,\s*enemy\s*,\s*map\s*\)\s*\{([\s\S]*)\}$/);
			if(!match)
				throw new Error('Could not find your function. Format must be function move(my, enemy, map).');
			this.compiledFn = new Function('my', 'enemy', 'map', match[1]);
			this.$status.attr('class','status success').html('No syntax errors');
			this.testBot();
		}
		catch(e) {
			this.status = 'error';
			this.$status.attr('class','status error').html('Compile Error - ' + e.message);
			this.$el.trigger('error.bot', this, e);
		}
	},
	testBot : function() {
		var match = new RoboTag.Match({
			p1: { move: this.compiledFn },
			p2: { move: function() { return { dx: 0, dy: 0 }; } },
			map: new RoboTag.Map({ random: true })
		});
		try {
			var result = match.run();
			if(result.id.indexOf('error') >= 0) {
				this.status = 'error';
				this.$status.attr('class','status error').html('Run Time Error - ' + result.description);
			}
			else {
				this.status = 'ready';
				this.$status.attr('class','status success').html('Ready');
				this.$el.trigger('ready.bot', this);
			}
		}
		catch(e) {
			this.status = 'error';
			this.$status.attr('class','status error').html('Run Time Error - ' + e.message);
			this.$el.trigger('error.bot', this);
		}
	},
	destroy : function() {
		this.$el.empty().off();
	}
});

RoboTag.CanvasPlayer = function(options) {
	options = options || {};
	if(!options.match)
		throw new Error('Player requires a match parameter');
	_.bindAll(this);
	_.extend(this, options);
	_.defaults(this, {
		cursor: 0,
		prevCursor: -1,
		intervalId: 0,
		intervalTime: 50,
		multiplier: 5,
		offset: { x: 25, y: 25 },
		robotSize: 40,
		itemSize: 20,
		fuelBarWidth: 30,
		fuelBarOffset: 10,
		showPath: false,
		showCoordinates: false,
		showItemValues: true,
		showFuelBars: true,
		p1Img: { offsetX: 500, offsetY: 107, height: 40, width: 40 },
		p2Img: { offsetX: 451, offsetY: 108, height: 40, width: 40 },
		fuelImg: { offsetX: 549, offsetY: 124, height: 20, width: 20 },
		mineImg: { offsetX: 579, offsetY: 125, height: 20, width: 20 },
		container: document.createElement('div'),
		status: 'paused'
	});

	// cached selectors
	this.$el = $(this.container).addClass('rt-player').html(this.template(this));
	this.$time = this.$('div.time > span');
	this.$p1fuel = this.$('div.p1.stats > .fuel');
	this.$p2fuel = this.$('div.p2.stats > .fuel');
	this.$message = this.$('div.message > span');
	this.$p1name = this.$('div.p1.name > span').html(this.match.p1.name);
	this.$p2name = this.$('div.p2.name > span').html(this.match.p2.name);
	this.$canvasRobots = this.$('.rt-canvas-robots');
	this.$canvasItems = this.$('.rt-canvas-items');
	this.$canvasFuel = this.$('.rt-canvas-fuel');
	this.$canvasOverlay = this.$('.rt-canvas-overlay');
	this.$seeker = this.$('.rt-player-slider');
	this.$dispCoordinates = this.$('#disp-coordinates');
	this.$dispItemVals = this.$('#disp-item-vals');
	this.$dispPath = this.$('#disp-path');
	this.$dispFuelBars = this.$('#disp-fuel-bars');
	this.$fuelSlider = this.$('#fuel-slider');
	this.$fuelQty = this.$('#fuel-qty');
	this.$mineSlider = this.$('#mine-slider');
	this.$mineQty = this.$('#mine-qty');

	// initialize jquery ui sliders
	var self = this;
	this.$seeker.slider({
		value: 0,
		max: (this.match && this.match.statLog.length-1) || 100,
		range: 'min',
		start: function(evt, ui) {
			self.pause();
		},
		slide: function(evt, ui) {
			self.cursor = ui.value;
			self.drawFrame();
		}
	});
	this.$fuelSlider.slider({
		value: this.match.map.fuelQty,
		max: 50,
		range: 'min',
		slide: function(evt, ui) {
			self.$fuelQty.html(ui.value);
		}
	});
	this.$mineSlider.slider({
		value: this.match.map.mineQty,
		max: 100,
		range: 'min',
		slide: function(evt, ui) {
			self.$mineQty.html(ui.value);
		}
	});

	// define event listeners
	this.$el.on('click', 'i.play', this.play);
	this.$el.on('click', 'i.pause', this.pause);
	this.$el.on('click', 'div.rt-canvas-overlay', this.togglePlayer);
	this.$el.on('transitionend webkitTransitionEnd', 'div.rt-canvas-overlay > div', this.resetOverlay);
	this.$el.on('change', '#disp-coordinates', function() {
		self.showCoordinates = $(this).prop('checked');
		self.drawRobots({ force: true });
	});
	this.$el.on('change', '#disp-item-vals', function() {
		self.showItemValues = $(this).prop('checked');
		self.drawItems({ force: true });
	});
	this.$el.on('change', '#disp-path', function() {
		self.showPath = $(this).prop('checked');
		self.drawRobots({ force: true });
	});
	this.$el.on('change', '#disp-fuel-bars', function() {
		self.showFuelBars = $(this).prop('checked');
		self.drawFuel({ force: true });
	});

	// load image for canvas, then draw the initial player
	this.sprite = document.createElement('img');
	this.sprite.src = './images/sprite.png';
	this.sprite.onload = function() {
		self.drawRobots();
		self.drawItems();
		self.drawFuel();
	};

	return this;
};

_.extend(RoboTag.CanvasPlayer.prototype, {
	template : _.template($('#template-player').html(), null, templateSettings),
	$ : function(s) { return this.$el.find(s); },
	mapToCanvas: function(point) {
		return { x: this.offset.x + (point.x * this.multiplier), y: (this.match.map.height - point.y) * this.multiplier + this.offset.y };
	},
	drawRobots: function(options) {
		options || (options = {});
		var log = this.match.statLog;
		var current = log[this.cursor];
		var prev = log[this.prevCursor];
		if(!options.force && prev && _.isEqual(_.pick(current[0],'x','y'), _.pick(prev[0],'x','y')) && _.isEqual(_.pick(current[1],'x','y'), _.pick(prev[1],'x','y'))) // no movement by either bot, don't redraw
			return;

		var canvas = this.$canvasRobots.get(0);
		var ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		var p1Map = this.mapToCanvas(current[0]);
		var p2Map = this.mapToCanvas(current[1]);

		if(this.showPath) { // draw path
			ctx.beginPath();
			ctx.moveTo(p1Map.x, p1Map.y);
			for(var i = this.cursor - 1; i >= 0; i--) {
				var mapped = this.mapToCanvas(log[i][0]);
				ctx.lineTo(mapped.x, mapped.y);
			}
			ctx.strokeStyle = '#FFFFFF';
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(p2Map.x, p2Map.y);
			for(var i = this.cursor - 1; i >= 0; i--) {
				var mapped = this.mapToCanvas(log[i][1]);
				ctx.lineTo(mapped.x, mapped.y);
			}
			ctx.strokeStyle = '#333333';
			ctx.stroke();
		}
		if(this.showCoordinates) {
			ctx.font = 'bold 10px Arial';
			ctx.textAlign = 'center';
			ctx.fillText('(' + current[0].x.toFixed(1) + ',' + current[0].y.toFixed(1) + ')', p1Map.x, p1Map.y + 0.8*this.robotSize);
			ctx.fillText('(' + current[1].x.toFixed(1) + ',' + current[1].y.toFixed(1) + ')', p2Map.x, p2Map.y + 0.8*this.robotSize);
		}
		if(current[0].fuel > current[1].fuel) {
			ctx.drawImage(this.sprite, this.p2Img.offsetX, this.p2Img.offsetY, this.p2Img.width, this.p2Img.height, p2Map.x - 0.5*this.robotSize, p2Map.y - 0.5*this.robotSize, this.robotSize, this.robotSize);	
			ctx.drawImage(this.sprite, this.p1Img.offsetX, this.p1Img.offsetY, this.p1Img.width, this.p1Img.height, p1Map.x - 0.5*this.robotSize, p1Map.y - 0.5*this.robotSize, this.robotSize, this.robotSize);	
		}
		else {
			ctx.drawImage(this.sprite, this.p1Img.offsetX, this.p1Img.offsetY, this.p1Img.width, this.p1Img.height, p1Map.x - 0.5*this.robotSize, p1Map.y - 0.5*this.robotSize, this.robotSize, this.robotSize);	
			ctx.drawImage(this.sprite, this.p2Img.offsetX, this.p2Img.offsetY, this.p2Img.width, this.p2Img.height, p2Map.x - 0.5*this.robotSize, p2Map.y - 0.5*this.robotSize, this.robotSize, this.robotSize);	
		}
	},
	drawItems: function(options) {
		options || (options = {});
		var cursor = this.cursor;
		var prevCursor = this.prevCursor;
		var log = this.match.itemLog;
		var map = this.match.map;

		var fuelTaken = _.filter(log, function(item) { return cursor >= item.turn && item.fuel >= 0; });
		var fuelTakenPrev = _.filter(log, function(item) { return prevCursor >= item.turn && item.fuel >= 0; });
		var minesTaken = _.filter(log, function(item) { return cursor >= item.turn && item.mine >= 0; });
		var minesTakenPrev = _.filter(log, function(item) { return prevCursor >= item.turn && item.mine >= 0; });

		if(!options.force && prevCursor >= 0 && _.isEqual(fuelTaken, fuelTakenPrev) && _.isEqual(minesTaken, minesTakenPrev)) // if no change to items taken, don't redraw
			return;

		fuelTaken = _.map(fuelTaken, function(item) { return map.fuelTanks[item.fuel]; });
		minesTaken = _.map(minesTaken, function(item) { return map.mines[item.mine]; });

		var fuelToDraw = _.difference(map.fuelTanks, fuelTaken);
		var minesToDraw = _.difference(map.mines, minesTaken);

		var canvas = this.$canvasItems.get(0);
		var ctx = canvas.getContext('2d');
		ctx.font = 'bold 10px Arial';
		ctx.textAlign = 'center';
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		_.each(fuelToDraw, function(fuel) {
			var mapped = this.mapToCanvas(fuel);
			ctx.drawImage(this.sprite, this.fuelImg.offsetX, this.fuelImg.offsetY, this.fuelImg.width, this.fuelImg.height, mapped.x - 0.5*this.itemSize, mapped.y - 0.5*this.itemSize, this.itemSize, this.itemSize); 
			if(this.showItemValues)
				ctx.fillText('+' + fuel.value, mapped.x-2, mapped.y + this.itemSize);
		}, this);

		_.each(minesToDraw, function(mine) {
			var mapped = this.mapToCanvas(mine);
			ctx.drawImage(this.sprite, this.mineImg.offsetX, this.mineImg.offsetY, this.mineImg.width, this.mineImg.height, mapped.x - 0.5*this.itemSize, mapped.y - 0.5*this.itemSize, this.itemSize, this.itemSize); 
			if(this.showItemValues)
				ctx.fillText('-' + mine.value, mapped.x-2, mapped.y + this.itemSize);
		}, this);

	},
	drawFuel: function(options) {
		options || (options = {});
		var log = this.match.statLog;
		var current = log[this.cursor];
		var canvas = this.$canvasFuel.get(0);
		var ctx = canvas.getContext('2d');
		ctx.font = 'bold 10px Arial';
		ctx.textAlign = 'center';
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if(!this.showFuelBars)
			return;
		var scaledHeight = current[0].fuel * ((canvas.height-20) / this.match.rules.maxFuel);
		ctx.fillStyle = '#FFFFFF';
		ctx.fillRect(this.fuelBarOffset, canvas.height - scaledHeight, this.fuelBarWidth, scaledHeight);
		ctx.fillStyle = '#333333';
		ctx.fillText(current[0].fuel.toFixed(1), this.fuelBarOffset + 0.5*this.fuelBarWidth, canvas.height - scaledHeight - 5);
		scaledHeight = current[1].fuel * ((canvas.height-20) / this.match.rules.maxFuel);
		ctx.fillRect(canvas.width - this.fuelBarWidth - this.fuelBarOffset, canvas.height - scaledHeight, this.fuelBarWidth, scaledHeight);
		ctx.fillText(current[1].fuel.toFixed(1), canvas.width - this.fuelBarOffset - 0.5*this.fuelBarWidth, canvas.height - scaledHeight - 5);
	},
	updateStats: function() {
		var current = this.match.statLog[this.cursor];
		this.$p1fuel.html(current[0].fuel.toFixed(0));
		this.$p2fuel.html(current[1].fuel.toFixed(0));
		this.$time.html(this.match.rules.maxTurns - this.cursor);
		if(this.cursor == (this.match.statLog.length - 1)) {
			if(this.match.result.winner == 'p1')
				this.$message.attr('class', 'p1').html(this.match.p1.name + ' wins!');
			else if(this.match.result.winner == 'p2')
				this.$message.attr('class', 'p2').html(this.match.p2.name + ' wins!');
			else if(!this.match.result.winner)
				this.$message.attr('class', 'neutral').html('Tie');
		}
	},
	drawFrame: function() {
		if(this.cursor >= this.match.statLog.length) {
			this.pause();
			this.cursor = this.match.statLog.length - 1;
			return false;
		}
		this.$message.attr('class', 'empty').html('');
		this.drawRobots();
		this.drawItems();
		this.drawFuel();
		this.updateStats();
		this.$seeker.slider('value', this.cursor);
		this.prevCursor = this.cursor;
		return true;
	},
	play: function() { // animate the match
		if(this.cursor >= this.match.statLog.length - 1)
			this.cursor = 0;
		clearInterval(this.intervalId);
		this.intervalId = setInterval(_.bind(function() {
			var f = this.drawFrame();
			f && this.cursor++;
		}, this), this.intervalTime);
		this.$('i.play').attr('class', 'icon-pause pause');
		this.status = 'playing';
	},
	pause: function() {
		clearInterval(this.intervalId);
		this.$('i.pause').attr('class', 'icon-play-2 play');
		this.status = 'paused';
	},
	togglePlayer: function() { // clicking on the canvas toggles play/pause with animation
		var $div = this.$('.rt-canvas-overlay > div');
		var $icon = $div.find('i');
		if(this.status == 'paused') {
			$icon.attr('class', 'icon-play-2');
			this.play();
		}
		else if(this.status == 'playing') {
			$icon.attr('class', 'icon-pause');
			this.pause();
		}
		$div.css({
			'-moz-transition': 'all 0.7s ease-out',
			'-webkit-transition': 'all 0.7s ease-out',
			'-o-transition': 'all 0.7s ease-out',
			'transition': 'all 0.7s ease-out',
			'-moz-transform': 'scale(1)',
			'-webkit-transform': 'scale(1)',
			'-o-transform': 'scale(1)',
			'transform': 'scale(1)',
			'opacity': 0
		});

	},
	resetOverlay: function() { // reset the animation
		this.$('.rt-canvas-overlay > div').css({
			'-moz-transition': '',
			'-webkit-transition': '',
			'-o-transition': '',
			'transition': '',
			'-moz-transform': 'scale(0)',
			'-webkit-transform': 'scale(0)',
			'-o-transform': 'scale(0)',
			'transform': 'scale(0)',
			'opacity': 1
		});
	},
	destroy: function() { // remove the player from the DOM and cancel events
		this.pause();
		this.$el.empty().off();
	}
});

RoboTag.initDemo = function() {
	var ed1 = RoboTag.ed1 = new RoboTag.CodeEditor({
		id: 1,
		container: $('div.rt-editor-wrapper.p1').get(0),
		editorId: 'rt-editor1',
		name: 'Player 1'
	});
	var ed2 = RoboTag.ed2 = new RoboTag.CodeEditor({
		id: 2,
		container: $('div.rt-editor-wrapper.p2').get(0),
		editorId: 'rt-editor2',
		name: 'Player 2',
		theme: 'monokai'
	});
	var player;
	var startPositions = [[25,25],[75,75]];

	function runMatch(p1, p2, options) {
		options || (options = {});

		var fuelQty = parseInt($('#fuel-qty').text());
		fuelQty || fuelQty === 0 || (fuelQty = 20);
		var mineQty = parseInt($('#mine-qty').text());
		mineQty || mineQty === 0 || (mineQty = 60);
		startPositions = options.swap ? startPositions.reverse() : [[25,25],[75,75]];

		var map = options.swap ? _.deepClone(_.extend(player.match.map, { startPositions: startPositions })) : new RoboTag.Map({
			p1: p1,
			p2: p2,
			fuelQty: fuelQty,
			mineQty: mineQty,
			random: true
		});
		var match = new RoboTag.Match({
			p1: p1,
			p2: p2,
			map: map
		});

		var result = match.run();
		if(result.id == 'p1 error') {
			ed1.$status.attr('class', 'status error').html(result.description);
			$('html, body').animate({ scrollTop: $('h3.step1').offset().top - 45 }, 500);
		}
		else if(result.id == 'p2 error') {
			ed2.$status.attr('class', 'status error').html(result.description);
			$('html, body').animate({ scrollTop: $('h3.step1').offset().top - 45 }, 500);
		}
		else {
			player && player.destroy();
			player = new RoboTag.CanvasPlayer({
				match: match,
				container: $('#rt-demo-player').get(0)
			});
			$('html, body').animate({ scrollTop: $('h3.step2').offset().top - 45 }, 500, player.play);
		}
	}

	var p1;
	var p2;
	$('div.rt-editor-wrapper').on('ready.bot', function(evt, editor) {
		if(editor.id == 1)
			p1 = { name: editor.name, move: editor.compiledFn };
		else if(editor.id == 2)
			p2 = { name: editor.name, move: editor.compiledFn };
		if(p1 && p2) {
			p1 = _.pick(p1, 'name', 'move');
			p2 = _.pick(p2, 'name', 'move');
			runMatch(p1, p2);
		}
	}).on('error.bot edited.bot', function(evt, editor) {
		if(editor.id == 1)
			p1 = null;
		else if(editor.id == 2)
			p2 = null;
	});

	$('body').on('click', 'button.swap', function(evt) {
		if(p1 && p2) {
			p1 = _.pick(p1, 'name', 'move');
			p2 = _.pick(p2, 'name', 'move');
			runMatch(p1, p2, { swap: true });
		}
	});

	$('body').on('click', 'button.rematch', function(evt) {
		if(p1 && p2) {
			p1 = _.pick(p1, 'name', 'move');
			p2 = _.pick(p2, 'name', 'move');
			runMatch(p1, p2);
		}
	});
}

RoboTag.sampleBots = {

'Lazy Bot': '// never move\n' + (function move(my, enemy, map) {
	return { dx: 0, dy: 0 };
}).toString(),
'Random Bot': '// move randomly within allowed limits\n' + (function move(my, enemy, map) {
	var dx = Math.random() * 6 - 3;
	var dyMax = Math.sqrt(9 - (dx * dx));
	var dy = Math.random() * (2 * dyMax) - dyMax;
	return { dx: dx, dy: dy };
}).toString(),
'Bouncy Bot': '// move at constant speed and bounce off walls\n// demonstration of saving persistent variables\n' + (function move(my, enemy, map) {
	if(typeof(this.dx) == 'undefined') {
		this.dx = 1;
		this.dy = -1;
	}
	if(my.x == 100 || my.x === 0)
		this.dx *= -1;
	if(my.y == 100 || my.y === 0)
		this.dy *= -1;
	return { dx: this.dx, dy: this.dy };
}).toString(),
'Hungry Bot': '// go to closest fuel tank at constant rate of 2\n// when all tanks are gone, go to enemy at constant rate of 2.99 (avoid exceeding limit due to rounding issues)\n' + (function move(my, enemy, map) {
	var closestFuelTank = false;
	var minDistance=1000;
	var dx, dy, d, th, myMove = {};

	map.fuelTanks.forEach(function(ft) {
		dx = my.x - ft.x;
		dy = my.y - ft.y;
		d = Math.sqrt(dx*dx + dy*dy);
		if(d < minDistance) {
			minDistance = d;
			closestFuelTank = ft;
		}
	});

	if(closestFuelTank) {
		dx = closestFuelTank.x - my.x;
		dy = closestFuelTank.y - my.y;
		th = Math.atan(Math.abs(dy/(dx || 0.01)));
		myMove.dx = 2*Math.cos(th)*(dx < 0 ? -1 : 1);
		myMove.dy = 2*Math.sin(th)*(dy < 0 ? -1 : 1);
	}
	else {
		dx = enemy.x - my.x;
		dy = enemy.y - my.y;
		th = Math.atan(Math.abs(dy/(dx || 0.01)));
		myMove.dx = 2.99*Math.cos(th)*(dx < 0 ? -1 : 1);
		myMove.dy = 2.99*Math.sin(th)*(dy < 0 ? -1 : 1);
	}

	return myMove;
}).toString()

};

})(this);
