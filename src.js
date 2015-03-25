var app = angular.module('myapp', []);

TO_HIT_ROLL = -6;
INTEREST_RATE = 1.3512;
BASE_TO_HIT_ROLL = 2;
BASE_DAMAGE_ON_HIT = 16;
ROLL_ARRAY = [24,21,18,16,14,12,10,9,8,7,6,5,5,4,3,3];
DIE_SIDES = 24;

app.factory('powerService', function() {
    function expectedDamage(forRoll, rounds, toHit, channelRounds) {
        var i = 0,
            total = 0;

        for(var roundi = 0; roundi < rounds.length; roundi++) {
			var round = rounds[roundi];
            var interest = Math.pow(INTEREST_RATE, i + channelRounds);
            for(var attacki = 0; attacki < round.attacks.length; attacki++) {
				var attack = round.attacks[attacki];
                var mult = 1;
				if(forRoll == TO_HIT_ROLL) {
					mult *= getIdealRollOdds(-BASE_TO_HIT_ROLL - toHit);
				} else {
					mult *= getRealRollOdds(forRoll);
				}

                for(var conditioni =0; conditioni < attack.conditions.length; conditioni++) {
					var condition = attack.conditions[conditioni];
					if(condition.enemyRolls) {
						mult *= (1 - getRealRollOdds(condition.difficulty));
					} else {
						mult *= getRealRollOdds(condition.difficulty);
					}
                }
                total += attack.damage * mult / interest;
            }
            i += 1;
        }
        return total;
    };

	function getIdealRollOdds(roll) {
		return 1 / Math.pow(2, roll / 5 + 1)
	}

	function getRealRollOdds(roll) {
		return ROLL_ARRAY[roll+5] / DIE_SIDES;
	}

	return function(toHit, channelRounds, exhaustRounds, rounds) {
        var power = 0;
        var roundcount = channelRounds + exhaustRounds + 1;
        for(var i = 0; i < roundcount; i++) {
            power += 1 / Math.pow(INTEREST_RATE, i);
        }
        var balancedPower = power * getIdealRollOdds(-BASE_TO_HIT_ROLL) * BASE_DAMAGE_ON_HIT;

        var thisPower = expectedDamage(TO_HIT_ROLL, rounds, toHit, channelRounds);
        var powerRatio = thisPower / balancedPower;

        return 5 * Math.log(powerRatio, 2);
    };
});

app.controller('mycontroller', ['$scope', 'powerService', function($scope, powerService) {
    $scope.rounds = [];
    $scope.attacks = [{name: 'Default'}];
    $scope.conditions = [];
    $scope.channelRounds = 0;
    $scope.exhaustRounds = 0;
    $scope.toHit = 0;
    $scope.newRound = function() {
        $scope.rounds.push({
            attacks: [],
            newAttack: function() {
                this.attacks.push({
                    damage: 2,
                    conditions: [],
               });
            },
        });

		// guarantee at least one round
		$scope.rounds[$scope.rounds.length - 1].newAttack();
		$scope.setOpenRound($scope.rounds[$scope.rounds.length - 1]);
    };

	$scope.deleteCondition = function(condition) {
		$scope.conditions.splice($scope.conditions.indexOf(condition), 1);
		for(var i = 0; i < $scope.rounds.length; i++) {
			for(var b = 0; b < $scope.rounds[i].attacks.length; b++) {
				var condsarr = $scope.rounds[i].attacks[b].conditions;
				condsarr.splice(condsarr.indexOf(condition), 1);
			}
		}
	}

	$scope.conditionsNotInAttack = function(attack, conditions) {
		return conditions.filter(function(c) {
			return attack.conditions.indexOf(c) === -1;
		});
	};

	$scope.getPower = function() {
		return powerService($scope.toHit, $scope.channelRounds, $scope.exhaustRounds, $scope.rounds);
	};

    $scope.getOverload = function() {
		var uniqueRolls = $scope.attacks.length + $scope.conditions.length;
		if (uniqueRolls > 31) {
        	return 'too many attacks and conditions';
		}

		var totalRounds = $scope.channelRounds + 1 + $scope.exhaustRounds;
		var baseOddsToHit = getIdealRollOdds(BASE_TO_HIT_ROLL);
		var minVariance = baseOddsToHit * Math.pow(BASE_DAMAGE_ON_HIT * (1 - baseOddsToHit),2);
		
		var attackCount = $scope.attacks.length;
		
		var largestIndex = (1 << (uniqueRolls + 1)) - 1;
		
		for (i=-5; i<=10; i++) {
			var exD = expectedDamage(i);
			var variance = 0;
			for (j=0; j<=largestIndex; j++) {
				var odds = 1;
				for (k=0; k<attackCount; k++) {
					if ((1 << k) == ((1 << k) & j)) {
						odds *= getRealRollOdds(i);
					} else {
						odds *= (1 - getRealRollOdds(i));
					}
				}
				for (k=0; k<$scope.conditions.length; k++) {
					var mask = 1 << (k+attackCount);
					flip = conditions[k].enemyRolls << (k+attackCount);
					if (mask == (((mask & j) ^ flip))) {
						odds *= getRealRollOdds(conditions[k].difficulty);
					} else {
						odds *= (1 - getRealRollOdds(conditions[k].difficulty));
					}
				}
				
				var indexDamage = 0
				for (k=0; k < $scope.rounds.length) {
					var roundDamage = 0;
					var interest = Math.pow(INTEREST_RATE, k+$scope.channelRounds);
					for (l=0; l<attackCount; l++) {
						var hit == (1 << l) & j;
						for each (condition in attack.conditions) {
							var shift = $scope.conditions.indexOf(condition) + attackCount;
							hit &= (i & (1 << shift)) == (1 << shift);
							if (!hit) {break;}
						}
						if (hit) {
							roundDamage += attack.damage;
						}
					indexDamage += roundDamage / interest;
					}
				}
				variance += odds * Math.pow(indexDamage - exD,2);
			}
			if (variance > minVariance) {
				return i;
			}
		}
		
		return 'Overload not Found';
    };

	$scope.setOpenRound = function(v) {
		$scope.openRound = v;
	};

}]);

app.filter('conditionStr', function() {
	return function(condition) {
		if(condition.difficulty == TO_HIT_ROLL) {
			return "if caster hits on attack roll'" + this.name + "'";
		} else {
			if(condition.enemyRolls) {
				roller = "targeted enemy does not get"
			} else {
				roller = "caster gets"
			}
			return "if " + roller + " a " + condition.difficulty + " or better on roll '" + condition.name + "'";
		}
	}
});

app.filter('attackStr', function(conditionStrFilter) {
	return function(attack) {
		return "Deals " + attack.damage + " damage " +
			attack.conditions
				.map(conditionStrFilter)
				.join(' and ');
	};
});

app.filter('roundStr', function(attackStrFilter) {
	return function(round) {
		return round.attacks
				.map(attackStrFilter)
				.join(' and ');
	};
});

app.filter('spellStr', function(roundStrFilter) {
	return function(spell) {
        var descr = '',
            roundsPastChannel = Math.max(spell.rounds.length, spell.exhaustRounds) + 1;
        for(var i = 0; i < spell.channelRounds + roundsPastChannel; i++) {
            descr += "Round " + (i+1) + ": ";
            if(i < spell.channelRounds)
                descr += "Caster channels the spell. ";
            else if(i == spell.channelRounds)
                descr += "Caster casts the Spell. ";
            else if(i < spell.channelRounds + 1 + spell.exhaustRounds)
                descr += "Caster is Exhausted. ";
            else
                descr += "Caster may perform other Actions. ";

            if(curRound = spell.rounds[i - spell.channelRounds])
                descr += roundStrFilter(curRound);

            descr += ".....";
        }
        return descr;
	};
});

app.directive('slideToggle', function() {
	return {
        restrict: "A",
        link: function (scope, element, attr) {
            var slideDuration = parseInt(attr.slideToggleDuration, 10) || 200;
			var first = true;
            scope.$watch(attr.slideToggle, function (val) {
				if(first && val) return;
				else first = false;
				element.stop().slideToggle(slideDuration);
            });
        }
    };
});
