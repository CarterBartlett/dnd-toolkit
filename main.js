document.getElementById('minimum-stat-threshold').onchange = function() {
    let value = parseInt(this.value);
    if (value > 90) {
        this.value = 90;
    }
    if (value < 0) {
        this.value = 0;
    }
};

document.getElementById('roll-button').addEventListener('click', function() {
    let rollMethod = document.querySelector('input[name="rolling-method"]:checked').value;
    let statThreshold = document.getElementById('minimum-stat-threshold').value;
    let atLeastOne16 = document.getElementById('guarantee-16').checked;
    let statSets = [];
    let statTotal;
    let keepRolling;
    let statRollCount = 0;
    do {
        keepRolling = false;
        statRollCount++;
        statTotal = 0;
        for (let i=0; i<6; i++) {
            statSets[i] = {
                "total": 0,
                "rolls": []
            };

            switch (rollMethod) {
                case 'standard': {
                    for (let j=0; j<4; j++) {
                        roll = Math.floor(Math.random() * 6) + 1;
                        statSets[i]['rolls'].push(roll);
                        statTotal += roll;
                    }
                    statSets[i]['total'] = statSets[i]['rolls'].sort((a, b) => b - a).slice(0, 3).reduce((sum, val) => sum + val, 0);
                    break;
                }
                case 'classic': {
                    for (let j=0; j<3; j++) {
                        roll = Math.floor(Math.random() * 6) + 1;
                        statSets[i]['rolls'].push(roll);
                        statTotal += roll;
                    }
                    statSets[i]['total'] = statSets[i]['rolls'].reduce((sum, val) => sum + val, 0);
                    break;
                }
            }
            
            statSets[i]['rolls'].sort((a, b) => b - a);
            statSets[i]['modifier'] = toModifier(statSets[i]['total']);
        }
        statSets['total'] = statTotal;
        statSets['average'] = statTotal / 6;
        const minTotal = 3 * 6; // Minimum possible total (3 per stat, 6 stats)
        const maxTotal = 18 * 6; // Maximum possible total (18 per stat, 6 stats)
        let luckFactor = statTotal === minTotal ? 0 : (statTotal - minTotal) / (maxTotal - minTotal) * 100;
        statSets['luckFactor'] = luckFactor.toFixed(2);

        if (statTotal<statThreshold) {
            keepRolling = true;
        }
        if (atLeastOne16) {
            console.log(statSets.filter(stats => stats.total >= 16));
            if(statSets.filter(stats => stats.total >= 16).length === 0) {
                keepRolling = true;
            }
        }

        if (statRollCount > 100000) {
            alert("Rolled over 100,000 times, something is probably wrong. Stopping.");
            keepRolling = false;
        }
    } while(keepRolling);

    for (stat in statSets) {
        if (['total', 'average', 'luckFactor'].includes(stat)) continue;
        stat_num = parseInt(stat)+1;
        document.getElementById("stat-" + stat_num).querySelector("h1").innerText = statSets[stat]['total'];
        document.getElementById("stat-" + stat_num).querySelector("p.rolls").innerText = statSets[stat]['rolls'].join(",");
        document.getElementById("stat-" + stat_num).querySelector("p.modifier").innerText = statSets[stat]['modifier'];
    }

    stat_totals = Object.values(statSets).map(stat => stat.total).filter(total => total !== undefined);

    document.getElementById('stat-total').innerText = statSets['total'];
    document.getElementById('stat-lowest').innerText = `${Math.min(...stat_totals)} (${toModifier(Math.min(...stat_totals))})`;
    document.getElementById('stat-highest').innerText = `${Math.max(...stat_totals)} (${toModifier(Math.max(...stat_totals))})`;
    document.getElementById('stat-average').innerText = (statSets['average']).toFixed(2);
    document.getElementById('stat-luck-factor').innerText = `${statSets['luckFactor']}%`;
});

document.querySelectorAll('.stat-select').forEach(function(element, index) {
    element.addEventListener('change', onStatChange);
});

document.getElementById('remove-stat-allocations').addEventListener('click', function() {
    document.querySelectorAll('.stat-select').forEach(function(dropdown) {
        dropdown.value = '';
        onStatChange();
    });
});

document.getElementById('add-counter').addEventListener('click', function() {
    const container = document.getElementById('counters-container');
    const counterDiv = document.createElement('div');
    counterDiv.className = 'counter';
    counterDiv.innerHTML = `
        <div style="background-color: #d9d9d9; display: flex; flex-direction: column;margin:2px;width:100px;">
            <input type="text" class="counter-name" placeholder="Name" style="margin:2px;" />
            <input type="text" class="counter-value" style="color:black;align-self:center;font-size:40px;width:90%;text-align:center;" value="0" />
            <div style="display: flex;">
                <button class="decrement-counter" style="width:100%;background-color:orange;color:white;">-</button>
                <button class="increment-counter" style="width:100%;background-color:green;color:white;">+</button>
            </div>
            <button class="remove-counter" style="background-color:red;color:white;">Remove</button>
        </div>
    `;
    container.appendChild(counterDiv);
    
    counterDiv.querySelector('.counter-value').addEventListener('change', function() {
        let value = parseInt(this.value);
        let autoremove = document.getElementById('remove-counter-on-expire').checked;

        if (value < 0 && autoremove) {
            container.removeChild(counterDiv);
        }
    });

    counterDiv.querySelector('.increment-counter').addEventListener('click', function() {
        const counterValue = counterDiv.querySelector('.counter-value');
        counterValue.value = parseInt(counterValue.value) + 1;
        counterValue.dispatchEvent(new Event('change'));
    });

    counterDiv.querySelector('.decrement-counter').addEventListener('click', function() {
        const counterValue = counterDiv.querySelector('.counter-value');
        counterValue.value = parseInt(counterValue.value) - 1;
        counterValue.dispatchEvent(new Event('change'));
    });

    counterDiv.querySelector('.remove-counter').addEventListener('click', function() {
        container.removeChild(counterDiv);
    });
});

document.getElementById('increment-all-counters').addEventListener('click', function() {
    document.querySelectorAll('.counter-value').forEach(function(counterValue) {
        counterValue.value = parseInt(counterValue.value) + 1;
        counterValue.dispatchEvent(new Event('change'));
    });
});
document.getElementById('decrement-all-counters').addEventListener('click', function() {
    document.querySelectorAll('.counter-value').forEach(function(counterValue) {
        counterValue.value = parseInt(counterValue.value) - 1;
        counterValue.dispatchEvent(new Event('change'));
    });
});
document.getElementById('reset-all-counters').addEventListener('click', function() {
    document.querySelectorAll('.counter-value').forEach(function(counterValue) {
        counterValue.value = 0;
        counterValue.dispatchEvent(new Event('change'));
    });
});

document.getElementById('remove-all-counters').addEventListener('click', function() {
    document.getElementById('counters-container').innerHTML = '';
});

function onStatChange(){
    const usedOptions = Array.from(document.querySelectorAll('.stat-select')).map(function(dropdown) {
        return dropdown.value;
    });

    document.querySelectorAll('.stat-select').forEach(function(dropdown) {
        for (let option of dropdown.options) {
            if (option.value == '') continue;
            option.disabled = (usedOptions.includes(option.value) && option.value !== dropdown.value);
        }
    });
}

function toModifier(stat) {
    let modifier = Math.floor((stat - 10) / 2);
    return (modifier >= 0 ? "+" : "") + modifier;
}