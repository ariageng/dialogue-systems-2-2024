import "./style.css";
import { setupTeachMachine } from "./TeachMachine";
import { setupOrderMachine } from "./OrderMachine";

// Set up the HTML elements
const appElement = document.querySelector<HTMLElement>("#app");

if (!appElement) {
  throw new Error("No element with id 'app' found in the HTML");
} else {
  appElement.innerHTML = ` 
    <div>
      <div id="suggestions"></div>
      <div id="order-confirmation"></div>
      <div id="narrator-bubble"></div>
      <div id="chatting-bubbles">
        <span id="frog-bubble"></span>
        <span id="character-bubble"></span>
      </div>
      <div id="characters">
        <span id="frog-span">
          <img id="frog-image" class="character" src="src/frog_normal.gif" alt="frog is taking a nap">
        </span>
      </div>
      <div id="contextContainer"></div>
      <div class="card">
        <div id="teach-start-button"></div>
        <div id="order-start-button"></div>
        <div id="talk-button"></div>
      </div>
      <div id="buttons"></div>
      <div id="teachmore-button"></div>
    </div>
  `;
}

// set up the TeachMachine if the teach start button is clicked, set up the OrderMachine if the order start button is clicked
window.addEventListener('DOMContentLoaded', () => {
  const teachStartButton = document.querySelector<HTMLElement>("#teach-start-button");
  const orderStartButton = document.querySelector<HTMLElement>("#order-start-button");

  setupTeachMachine(teachStartButton);
  setupOrderMachine(orderStartButton);
});