/* Helper functions */


function showNarratorText(targetText) {
    // Get the parent div with id "narrator-bubble"
    const narratorBubbleDiv = document.querySelector<HTMLElement>("#narrator-bubble");
  
    // Remove existing chat bubbles
    if (!narratorBubbleDiv) return; // Return if the narrator bubble does not exist; which is the case when the game is over

    while (narratorBubbleDiv.firstChild) {
      narratorBubbleDiv.removeChild(narratorBubbleDiv.firstChild);
    }
    
    // Create a new div for the chat bubble
    const chatBubble = document.createElement("div")
    chatBubble.classList.add("narrator-bubble");
    
    // Add text to the chat bubble
    const textElement = document.createElement("p");
    textElement.textContent = targetText
    
    // Append the text element to the chat bubble
    chatBubble.appendChild(textElement)
  
    // Append the chat bubble to the parent div
    narratorBubbleDiv.appendChild(chatBubble);  
  
    // Ensure the narrator bubble is visible
    narratorBubbleDiv.style.display = "flex";
}
  
function showFrogText(targetText) {
// Get the parent div with id "frog-bubble"
const frogBubbleSpan = document.querySelector<HTMLSpanElement>("#frog-bubble");

// Remove existing chat bubbles
if (!frogBubbleSpan) return;
while (frogBubbleSpan.firstChild) {
    frogBubbleSpan.removeChild(frogBubbleSpan.firstChild);
}

// Create a new span for the chat bubble
const chatBubble = document.createElement("span")
chatBubble.classList.add("chat-bubble");

// Add text to the chat bubble
const textElement = document.createElement("p");
textElement.textContent = targetText

// Append the text element to the chat bubble
chatBubble.appendChild(textElement)

// Append the chat bubble to the parent div
frogBubbleSpan.appendChild(chatBubble);  
}

function hideFrogText() {
const frogBubbleSpan = document.querySelector("#frog-bubble");
if (frogBubbleSpan) {
    while (frogBubbleSpan.firstChild) {
    frogBubbleSpan.removeChild(frogBubbleSpan.firstChild);
    }
}
}

function showCharacterText(targetText) {
// Get the parent span with id "character-bubble"
const characterBubbleSpan = document.querySelector<HTMLSpanElement>("#character-bubble");

// Remove existing chat bubbles
if (!characterBubbleSpan) return;
while (characterBubbleSpan.firstChild) {
    characterBubbleSpan.removeChild(characterBubbleSpan.firstChild);
}

// Create a new span for the chat bubble
const chatBubble = document.createElement("span")
chatBubble.classList.add("chat-bubble");

// Add text to the chat bubble
const textElement = document.createElement("p");
textElement.textContent = targetText

// Append the text element to the chat bubble
chatBubble.appendChild(textElement)

// Append the chat bubble to the parent div
characterBubbleSpan.appendChild(chatBubble);  
}

function hideCharacterText() {
const characterBubbleSpan = document.querySelector("#character-bubble");
if (characterBubbleSpan) {
    while (characterBubbleSpan.firstChild) {
    characterBubbleSpan.removeChild(characterBubbleSpan.firstChild);
    }
}
}

function frogSpeak() {
const frogImage = document.getElementById("frog-image") as HTMLImageElement | null;

// Replace existing gif
if (frogImage) {
    frogImage.src = "src/frog_talking.gif";
}
}

function frogWaiting() {
const frogImage = document.getElementById("frog-image") as HTMLImageElement | null;

// Replace existing gif
if (frogImage) {
    frogImage.src = "src/frog_normal.gif";
}
}

function frogWithBurger() {
const frogImage = document.getElementById("frog-image") as HTMLImageElement | null; // Get the frog image element from the DOM

// Replace existing gif
if (frogImage) {
    frogImage.src = "src/frog_with_burger.gif";
}
}

function showCatshier() {
    // Get the parent div with id "characters"
    const characterDiv = document.getElementById("characters");
    if (!characterDiv) return;
  
    const newCharacter = document.createElement("span");
    newCharacter.setAttribute("id", "catshier-span");
  
    // Create an image element
    const newImage = document.createElement("img");
    newImage.setAttribute("id", "catshier-image"); // Add this line
    newImage.classList.add("character");
    newImage.src = "src/catshier.gif";
    newImage.alt = "Catshier";
  
    // Append the image to the newly created span
    newCharacter.appendChild(newImage);
  
    // Append the chat bubble to the parent div
    characterDiv.appendChild(newCharacter);  
  }
  
function CatshierHappy() {
const catshierImage = document.getElementById("catshier-image") as HTMLImageElement | null;

// Replace existing gif
if (catshierImage) {
    catshierImage.src = "src/catshier_happy.gif";
}
}

function CatshierAnnoyed() {
const catshierImage = document.getElementById("catshier-image") as HTMLImageElement | null;

// Replace existing gif
if (catshierImage) {
    catshierImage.src = "src/catshier_annoyed.gif";
}
}

function hideNarratorText() {
// Get the parent div with id "narrator-bubble"
const narratorBubbleDiv = document.querySelector<HTMLElement>("#narrator-bubble");

// Remove all child elements of the narrator bubble
if (!narratorBubbleDiv) return;
while (narratorBubbleDiv.firstChild) {
    narratorBubbleDiv.removeChild(narratorBubbleDiv.firstChild);
}

// Hide the narrator bubble
narratorBubbleDiv.style.display = "none";
}

function hideCatshier() {
// Get the parent div with id "characters"
const characterDiv = document.getElementById("characters");
if (!characterDiv) return;

// Get the character element
const characterSpan = characterDiv.querySelector("#catshier-span");

// Remove the character element if it exists
if (characterSpan) {
    characterSpan.remove();
}
}


function generateRepromptFormulation(repromptCounter) {
switch (repromptCounter) {
    case 1:
    return `Grodan väntar på att du ska säga något.`; // "Frog is waiting for you to say something."
    case 2:
    return `Förlåt, är du kvar?`; // "Sorry, are you still there?"
    case 3:
    return `Grodan lyssnar, säg något.`; // "Frog is listening, say something."
}
}


export { showNarratorText, showFrogText, hideFrogText, showCharacterText, hideCharacterText, frogSpeak, frogWaiting, frogWithBurger, showCatshier, hideNarratorText, hideCatshier, generateRepromptFormulation, CatshierHappy, CatshierAnnoyed };
