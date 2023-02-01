'use strict';

const urlParams = new URLSearchParams(window.location.search);
var interval = undefined;

function getCardName(card){
     // the card description from the server is all upppercase so we gotta fix that
    let desc = (card.value + " of " + card.suit).toLowerCase();
    return desc.charAt(0).toUpperCase() + desc.slice(1);
}

function createCardNode(card, makeClickable = false){
    let node = document.createElement("img");
    node.classList.add("card");
    node.src = card.image;
    node.alt = getCardName(card);
    node.dataset.code = card.code;
    if (makeClickable){
        node.onclick = () => discard(card.code);
    }
    return node
}

function createRevealedHand(playerName, cards){
    let node = document.createElement("div");
    let headerNode = document.createElement("h3");
    headerNode.innerText = playerName;
    node.appendChild(headerNode);
    for (let card of cards){
        node.appendChild(createCardNode(card));
    }
    return node;
}

async function getPublicGameData(){
    let response = await fetch(urlParams.get("server_url") + "/game?game_id=" + urlParams.get("game_id"));
    let responseContent = await response.json();
    return responseContent;
}

async function getSecretGameData(){
    let response = await fetch(
        urlParams.get("server_url") 
        + "/game/player_hand?game_id=" + urlParams.get("game_id") 
        + "&player_id=" + urlParams.get("player_id")
    );
    let responseContent = await response.json();
    return responseContent;
}

function updatePlayArea(publicGameData){
    const announcementsElem = document.getElementById("announcements");
    if(publicGameData.is_over === true){
        announcementsElem.innerText = "The game is over!";
        if (publicGameData.winner !== undefined && publicGameData.winner !== null){
            announcementsElem.innerText += " The winner is " + publicGameData.winner;
        }
    } else if (publicGameData.knocker !== undefined && publicGameData.knocker !== null){
        announcementsElem.innerText = publicGameData.knocker + " has knocked";
    } else {
        announcementsElem.innerText = "";
    }

    const newGameButton = document.getElementById("new_game_button");
    if(publicGameData.is_over === true){
        newGameButton.classList.remove("hidden");
    } else {
        newGameButton.classList.add("hidden");
    }

    const playerHandsContainer = document.getElementById("revealedCards");
    playerHandsContainer.innerHTML = "";
    if (publicGameData.player_hands !== undefined && publicGameData.player_hands !== null){
        for (let item of Object.entries(publicGameData.player_hands)){
            playerHandsContainer.appendChild(createRevealedHand(item[0], item[1]));
        }
    }

    const cardContainer = document.getElementById("disCard");
    cardContainer.innerHTML = "";
    if (publicGameData.discard_card !== null){
        cardContainer.appendChild(createCardNode(publicGameData.discard_card));
    }
    const currentPlayerContainer = document.getElementById("currentPlayerName");
    if (publicGameData.current_player !== undefined && publicGameData.current_player !== null){
        currentPlayerContainer.innerText = publicGameData.current_player;
    } else {
        currentPlayerContainer.innerText = "no one";
    }
}

function updatePlayerCards(secretGameData, isCurrentPlayer){
    const cardContainer = document.getElementById("playerCards");
    cardContainer.innerHTML = "";
    for (let card of secretGameData){
        cardContainer.appendChild(createCardNode(card, secretGameData.length > 3));
    }
    if(secretGameData.length > 3){
        cardContainer.parentNode.classList.add("hasFourCards");
    } else {
        cardContainer.parentNode.classList.remove("hasFourCards");
    }
    const buttons = document.querySelectorAll("#playerActions input");
    for (let button of buttons){
        if (isCurrentPlayer){
            button.removeAttribute("disabled");
        } else {
            button.setAttribute("disabled", "");
        }
    }
}

async function updateGame(){
    const playerContainer = document.getElementById("playerName");
    playerContainer.innerText = urlParams.get("player_id");
    let responses = await Promise.all([
        getPublicGameData(), 
        getSecretGameData()
    ]);
    let publicGameData = responses[0];
    let secretGameData = responses[1];
    let isCurrentPlayer = (publicGameData.current_player === urlParams.get("player_id")) && !publicGameData.is_over;
    updatePlayArea(publicGameData);
    updatePlayerCards(secretGameData, isCurrentPlayer);

    // If it's not currently our turn, we want to regularly check for game updates.
    // If it is our turn, there's no need, because any state changes will be caused by us, so we'll know about it right away.
    // Also if the game's over, because in that case any player may at any time start a new game.
    if ((publicGameData.is_over || !isCurrentPlayer) && interval === undefined){
        interval = setInterval(updateGame, 5000);
    } else if ((!publicGameData.is_over && isCurrentPlayer) && interval !== undefined){
        clearInterval(interval);
        interval = undefined;
    }
}

async function doAction(actionData){

    const content = JSON.stringify(actionData);
    const options = {
        method: 'POST',
        mode: 'cors', // no-cors, *cors, same-origin
        headers: {'Content-Type': 'application/json', 'Content-Length': content.length.toString()},
        body: content
    };

    const response = await fetch(urlParams.get("server_url") + "/game/", options);
    if (response.ok) {
        // there's no responsecontent when we post an action, instead we call updateGame to show the new state
        updateGame();
    } else {
        alert("The server did not accept your action.\n(See details in browser console)");
        console.log(response);
    }
}

async function draw(){
    await doAction({action: "draw", game_id: urlParams.get("game_id"), player_id: urlParams.get("player_id")});
}
async function takeDiscard(){
    await doAction({action: "take_discard", game_id: urlParams.get("game_id"), player_id: urlParams.get("player_id")});
}
async function knock(){
    await doAction({action: "knock", game_id: urlParams.get("game_id"), player_id: urlParams.get("player_id")});
}
async function discard(cardCode){
    await doAction({action: "discard", discard: cardCode, game_id: urlParams.get("game_id"), player_id: urlParams.get("player_id")});
}


async function newGame(){
    const content = JSON.stringify({game_id: urlParams.get("game_id")});
    const options = {
        method: 'POST',
        mode: 'cors', // no-cors, *cors, same-origin
        headers: {'Content-Type': 'application/json', 'Content-Length': content.length.toString()},
        body: content
    };
    const response = await fetch(urlParams.get("server_url") + "/game/create/existing/", options);
    if (response.ok) {
        // there's no responsecontent when we make a new game, instead we call updateGame to show the new state
        updateGame();
    } else {
        alert("The server did not accept your action.\n(See details in browser console)");
        console.log(response);
    }
}

window.onload = () => {
    updateGame();
}