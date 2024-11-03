import { assign, createActor, fromPromise, setup, ActorRefFrom } from "xstate";
import { speechstate } from "speechstate";
//import { createBrowserInspector } from "@statelyai/inspect";
import { NLU_KEY,KEY } from "./azure";
//import { grammar_prof } from "./grammar.js";
import { showNarratorText, hideNarratorText, showFrogText, hideFrogText, showCharacterText, hideCharacterText, showCatshier, hideCatshier, frogSpeak, frogWaiting, frogWithBurger, CatshierHappy, CatshierAnnoyed} from "./functions";

// const inspector = createBrowserInspector(); 
//basic speech recognition

interface AzureCredentials {
  endpoint: string;
  key: string;
}
const azureCredentials: AzureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

//nlu speech recognition
interface AzureLanguageCredentials extends AzureCredentials {
  deploymentName: string;
  projectName: string;
}
const azureLanguageCredentials: AzureLanguageCredentials = {
  endpoint:
  "https://language-resource-tianyigeng.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview",
  key: NLU_KEY,
  deploymentName: "frog_deploy",
  projectName: "frog",

};

interface Settings {
  azureLanguageCredentials: AzureLanguageCredentials;
  azureCredentials: AzureCredentials;
  asrDefaultCompleteTimeout: number;
  asrDefaultNoInputTimeout: number;
  locale: string;
  ttsDefaultVoice: string;
  frogVoice: string;
  catshierVoice: string;
}
const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials, /** global activation of NLU */
  azureCredentials: azureCredentials, 
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 4000,
  locale: "sv-SE",
  ttsDefaultVoice: "sv-SE-SofieNeural",
  frogVoice: "sv-SE-MattiasNeural",
  catshierVoice: "en-US-AdamMultilingualNeural",
  //speechRecognitionEndpointId: "9a735a2d-1224-4398-baaa-9b0c80e1032e",
};

// Define types for the context
interface GameContext {
  action_counter: number;
  noInputCount: number;
  input: string | null;
  wordOrSentence: "word" | "sentence" | null;
  feature: string | null;
  content: string | null;
  word: Record<string, { topic: string }>;
  sentence: Record<string, { topic: string }>;
  ssRef: ActorRefFrom<typeof speechstate>;
  messages?: Message[];
  orders?: Order[];
  lastResponse?: string;
}

/* Message */
interface Message { // This is the type of a single message
  role: "Catshier" | "Frog" | "Narrator";
  content: string;
}

/* Menu definition */
interface Menu {
  [index: string]: { food?: string; drink?: string };
}
const menu: Menu = { // This is the menu object that contains the food and drink options
  burger: { food: "Wax hamburgare" },
  french_fries: { food: "Wax pommes frites" },
  coke: { drink: "Wax cola" },
  milkshake: { drink: "Wax milkshake" },
};

/* Order definition */ 
interface Order {
  food?: { 
    item: string; 
    quantity: number 
  };
  drink?: { 
    item: string; 
    quantity: number 
  };
}


/* Suggestion */
interface Suggestion {
  text: string;
  category: "food" | "drink" | "question";
}

const suggestions: Suggestion[] = [
  { text: "hamburgare", category: "food" },
  { text: "coca cola", category: "drink" },
  { text: "pommes frites", category: "food" },
  { text: "Vad är menyn?", category: "question" },
  { text: "milkshake", category: "drink" },
  { text: "rekommendera något", category: "question" },
];

// Helper function
const generateRepromptFormulation = (count: number): string => {
  // Implementation here
  return "Please say something";
};

// Define types for the events
type GameEvent = 
  | { type: "ASRTTS_READY" }
  | { type: "CLICK" }
  | { type: "ASR_NOINPUT" }
  | { type: "GameOver" }
  | { type: "SPEAK_COMPLETE" }
  | { type: "STILL_Noinput" }
  | { type: "RECOGNISED", value: Array<{ utterance: string }>, nluValue: { topIntent: string } }
  | { type: "SELECT", value: string }
  | { type: "ORDER_CONFIRMED", value: string }
  | { type: "NO_ORDER" };



/* Game Machine */
const OrderMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent 
  },
  actions: {
    //Wipes out old button (if any), shows new Start button
    ShowStartButton: ({ context }) => {
      const orderElement = document.querySelector<HTMLElement>("#order-start-button");
      const teachElement = document.querySelector<HTMLElement>("#teach-start-button"); // Add this
      
      if (!orderElement) return;
    
      orderElement.style.display = "block";
      const existingStartButton = orderElement.querySelector("button");
      if (existingStartButton) {
        existingStartButton.remove();
      }
    
      const startButton = document.createElement("button");
      startButton.type = "button";
      startButton.innerHTML = "På restaurangen";
      startButton.addEventListener("click", () => {
        orderMachineActor.send({ type: "CLICK" });
        orderElement.style.display = "none";
        if (teachElement) teachElement.style.display = "none"; // Add this
      });
      orderElement.appendChild(startButton);
    },
    //Wipes out old button (if any), shows new Talk button and takes input
    ShowTalkButton: ({ context }) => {
      const element = document.querySelector<HTMLElement>("#talk-button");
      if (!element) return;

      //remove old buttons if any
      const existingTalkButton = element.querySelector("button");
      if (existingTalkButton) {
        existingTalkButton.remove();
      }
      //create new button
      const talkButton = document.createElement("button");
      talkButton.type = "button";
      talkButton.innerHTML = "Prata";
      // Start listening when clicked 
      talkButton.addEventListener("click", () => {
          context.ssRef.send({
          type: "LISTEN",
          value:{ nlu:true, completeTimeout: 5}});
          // Show changed text 
          talkButton.innerHTML = "Du pratar med Grodan..."
          });
      element.appendChild(talkButton);
      element.style.display = "block";
    },
    HideTalkButton:({}) => {
      const element = document.querySelector<HTMLElement>("#talk-button"); 
      if (!element) return;

      // Hide the Talk Button
      element.style.display = "none";
    },
    //Wipe out old texts, speak, and show new texts
    NarratorSpeak:({ context }, params: string) => {
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: params,
          voice: settings.ttsDefaultVoice,
        },
      });
      showNarratorText(params);
    },
    FrogSpeak:({ context }, params: string) => {
      showFrogText(params);
      frogSpeak();
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: params,
          voice: settings.frogVoice // sv-SE-SofieNeural
        },
      });
    },
    CatshierSpeak: ({ context }, params: string) => {
      showCharacterText(params);
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: params,
          voice: settings.catshierVoice // sv-SE-MattiasNeural
        },
      });
    },
    ShowButton: ({ context }) => {
      const element = document.querySelector<HTMLElement>("#buttons"); 
      if (!element) return;

      //remove old option buttons if any
      const existingButton = element.querySelector("button");
      if (existingButton) {
        existingButton.remove();
      }
      //generate option buttons
      const word_options = Object.keys(context.word);
      const sentence_options = Object.keys(context.sentence);
      for (const option of word_options) {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.innerHTML = option;
        optionButton.addEventListener("click", () => {
          orderMachineActor.send({type: "SELECT", value: option})
        });
        element.appendChild(optionButton)
      };
      for (const option of sentence_options) {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.innerHTML = option;
        optionButton.addEventListener("click", () => {
          orderMachineActor.send({type: "SELECT", value: option})
        });
        element.appendChild(optionButton)
      };
    },
    ShowTeachMoreButton: ({}) => {
      const element = document.querySelector<HTMLElement>("#teachmore-button"); 
      if (!element) return;

      //remove old buttons if any
      const existingButton = element.querySelector("button");
      if (existingButton) {
        existingButton.remove();
      }
      //create new button
      const Button = document.createElement("button");
      Button.type = "button";
      Button.innerHTML = "Gå tillbaka och lär ut mer.";
      element.appendChild(Button);
      element.style.display = "block";
      // Start listening when clicked 
      Button.addEventListener("click", () => {
        orderMachineActor.send({type: "CLICK"})
          });
    },
    RemoveTeachMoreButton: ({}) =>{
      const element = document.querySelector<HTMLElement>("#teachmore-button"); 
      if (!element) return;

      //remove old option buttons if any
      const existingButton = element.querySelector("button");
      if (existingButton) {
        existingButton.remove();
      }
    },
    RemoveButtons: ({}) => {
      const element = document.querySelector<HTMLElement>("#buttons"); 
      if (!element) return;

      // Remove all button elements within the container
      const buttons = Array.from(element.querySelectorAll("button"));
      buttons.forEach(button => {
      button.remove();
    });
    },
    ShowFrogDict: ({ context }) =>{
      const contextElement = document.getElementById("contextContainer");
      const result = { word:{}, sentence:{}};
      // word: {hello:{topic: "greeting"}, hi:{..},..}
      for (const learntWord in context.word) {
        result.word[learntWord] = context.word[learntWord];
      }
      for (const learntSent in context.sentence) {
        result.sentence[learntSent] = context.sentence[learntSent];
      }

      // Check if the element exists
      if (contextElement) {
      // Clear previous content if any
        contextElement.innerHTML = "";
      
      // Create a new paragraph element
      const paragraph = document.createElement("p");
      
      // Set the inner text of the paragraph to the context content
      paragraph.textContent = "Det här är din Grodordbok: "+ JSON.stringify(result);

      // Append the paragraph to the context container element
      contextElement.appendChild(paragraph);
      contextElement.style.display = "block";
      }
    },
    HideResults: ({}) => {
      const resultsElement = document.getElementById("contextContainer");

      // Check if the element exists
      if (resultsElement) {
        // Hide the element
        resultsElement.style.display = "none";
      }
    },
    HandleNoInput: ({ context }) => {
      if (context.noInputCount <=3 ) {
        const repromptFormulation = generateRepromptFormulation(context.noInputCount);
        context.ssRef.send({
          type: "SPEAK",
          value: { utterance: repromptFormulation },});
        context.noInputCount += 1;
        showNarratorText(repromptFormulation);
      } else {
        hideNarratorText();
        orderMachineActor.send({type: "STILL_Noinput"});;
      };
    },
    storeUtterance: assign(({ context, event }) => { 
      if (event.type === "RECOGNISED") {
        // log "Storing utterance"
        console.log("(Storing frog utterance...)");
        const currentUtterance = event.value[0].utterance;
        return {
          messages: [ // there is a bug here, messages is not defined
            ...context.messages || [], // copy the existing messages
            { role: "frog" as const, content: currentUtterance } // there is a bug here, currentUtterance is not defined
          ]
        };
      }
      return { messages: context.messages }; // Return existing messages to avoid undefined
    }),
    ShowSuggestions: ({ context }) => {
      const element = document.querySelector<HTMLElement>("#suggestions");
      if (!element) return;

      // Clear existing suggestions
      element.innerHTML = "";
      element.style.display = "flex";
      element.style.flexWrap = "wrap";
      element.style.gap = "10px";
      element.style.marginTop = "10px";

      suggestions.forEach(suggestion => {
        const button = document.createElement("button");
        button.className = `suggestion-btn ${suggestion.category}`;
        button.innerHTML = suggestion.text;
        
        // Add click handler for both pronunciation and selection
        button.addEventListener("click", () => {
          // Speak the suggestion
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: suggestion.text,
              voice: settings.ttsDefaultVoice,
            },
          });
          
          // After pronunciation, trigger the recognition event
          context.ssRef.send({
            type: "SPEAK_COMPLETE",
            value: {
              utterance: suggestion.text
            }
          });
        });
        
        element.appendChild(button);
      });
    },
    HideSuggestions: () => {
      const element = document.querySelector<HTMLElement>("#suggestions");
      if (element) {
        element.style.display = "none";
      }
    },
    showOrderConfirmation: ({ context }) => {
      const element = document.querySelector<HTMLElement>("#order-confirmation");
      if (!element) return;
  
      element.innerHTML = "";
      element.style.display = "block";
  
      const orderList = document.createElement("div");
      orderList.className = "order-list";
  
      // item row helper function
      const createItemRow = (item: { item: string; quantity: number }, label: string) => {
        const row = document.createElement("div");
        row.className = "order-item";
        
        const itemName = document.createElement("span");
        itemName.textContent = `${label}: ${item.item}`;
        
        const controls = document.createElement("div");
        controls.className = "quantity-controls";
        
        const minusBtn = document.createElement("button");
        minusBtn.textContent = "-";
        minusBtn.onclick = () => {
          if (item.quantity > 0) {
            item.quantity--;
            countSpan.textContent = item.quantity.toString();
          }
        };
        
        const countSpan = document.createElement("span");
        countSpan.className = "count";
        countSpan.textContent = item.quantity.toString();
        
        const plusBtn = document.createElement("button");
        plusBtn.textContent = "+";
        plusBtn.onclick = () => {
          item.quantity++;
          countSpan.textContent = item.quantity.toString();
        };
        
        controls.appendChild(minusBtn);
        controls.appendChild(countSpan);
        controls.appendChild(plusBtn);
        
        row.appendChild(itemName);
        row.appendChild(controls);
        
        return row;
      };
  
      // Add orders to the list
      const orders = context.orders || [];
      orders.forEach(order => {
        if (order.food) {
          orderList.appendChild(createItemRow(order.food, 'Mat'));
        }
        if (order.drink) {
          orderList.appendChild(createItemRow(order.drink, 'Dryck'));
        }
      });
  
      // Add confirm button
      const confirmBtn = document.createElement("button");
      confirmBtn.className = "confirm-order-btn";
      confirmBtn.textContent = "Bekräfta beställning";

      confirmBtn.onclick = () => {
          // Filter out any orders with quantity 0
        const updatedOrders = orders.filter(order => 
          (order.food && order.food.quantity > 0) || 
          (order.drink && order.drink.quantity > 0)
        );
        
        // if no items remain in the order, jump to the failed state
        if (updatedOrders.length === 0) {
          element.style.display = "none";
          orderMachineActor.send({ type: "NO_ORDER" });
          return;
        }

        // Create summary of remaining orders
        const foodOrders = updatedOrders
        .filter(o => o.food)
        .map(o => `${o.food!.quantity} ${o.food!.item}`);
        const drinkOrders = updatedOrders
          .filter(o => o.drink)
          .map(o => `${o.drink!.quantity} ${o.drink!.item}`);

        const finalOrder = [...foodOrders, ...drinkOrders].join(' och ');
        element.style.display = "none";// Hide confirmation UI
    
        // Send to state machine with value in the correct property
        orderMachineActor.send({ 
          type: "ORDER_CONFIRMED", 
          value: finalOrder  
        });
      };
  
      element.appendChild(orderList);
      element.appendChild(confirmBtn);
    },
    hideOrderConfirmation() {
      const element = document.querySelector<HTMLElement>("#order-confirmation");
      if (element) {
        element.style.display = "none";
      }
    }
        // FrogSpeak:({ context }, params) => {
    //   context.ssRef.send({
    //     type: "SPEAK",
    //     value: {
    //       utterance: params,
    //     },
    //   });
    //   showFrogText(params);
    // },
      // FrogLearn:({ context }, { data } ) =>  {
      //   const { wordOrSentence, newSentence, feature, content } = data;
      //   context[wordOrSentence][newSentence] = { [feature]: content};
      // },
  },
  actors:{
    get_ollama_models: fromPromise<any, null>(async () => { 
      return fetch("http://localhost:11434/api/tags").then((response) =>
        response.json()
      );
    }),
    fetch_completion: fromPromise(async ({input} :{input: { messages: Message[]}}) => {
      const lastMessageContent = input.messages[input.messages.length - 1]?.content || ""; // get the last message content
      console.log("Last message content:", lastMessageContent);
      console.log("Last message content:", lastMessageContent);

      const body = {
        model: "llama3.1",
        stream: false,
        temperature: 0.1,
        //this is the last message in the array of messages
        //messages: input.messages,
        prompt: `
        Du är en virtuell kassör på en snabbmatsrestaurang. Analysera kundens senaste meddelande: "${lastMessageContent}" och svara med ett JSON-objekt.

        Instruktioner för Intent-klassificering:
        1. "beställning" - när kunden beställer mat eller dryck
        2. "fråga_om_meny" - när kunden frågar vad som finns, vad ni säljer, vill se menyn
        3. "rekommendation" - när kunden ber om rekommendationer, tips, eller frågar vad som är bäst/populärt
        4. "övrigt" - för hälsningar eller andra frågor

        Exempel på format och svar:

        1. För beställningar:
        Input: "en hamburgare och en cola"
        {
          "intent": "beställning",
          "entities": {
            "food": [{"item": "hamburgare", "quantity": 1}],
            "drink": [{"item": "cola", "quantity": 1}]
          }
        }

        2. För menyfrågor:
        Input: "vad har ni för mat?"
        Input: "kan jag se menyn?"
        Input: "vad säljer ni?"
        {
          "intent": "fråga_om_meny",
          "entities": null
        }

        3. För rekommendationer:
        Input: "vad rekommenderar du?"
        Input: "vad är gott här?"
        Input: "vad är populärast?"
        {
          "intent": "rekommendation",
          "entities": null
        }

        4. För övrigt:
        Input: "hej"
        Input: "tack"
        {
          "intent": "övrigt",
          "entities": null
        }

        Tillgängliga mat/dryck-alternativ:
        - Mat: hamburgare, pommes frites
        - Dryck: cola, milkshake

        Svara alltid med korrekt formaterad JSON enligt exemplen ovan.`,
        format: "json",
      };

      
      console.log("Request body:", JSON.stringify(body, null, 2)); // 这里的body 是一个object，包含了model和messages
      
      try {
        const response = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          body: JSON.stringify(body), // is the prompt the last message in the array of messages? 
        }); //stringify converts a JavaScript object or value to a JSON string

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log("API Response:", response);

        const textResponse = await response.text();
        console.log("Text API Response:", textResponse);

        // store the message part (including role and content) of the response in a variable
        const jsonResponse = JSON.parse(textResponse).response;
        console.log("JSON API Response:", jsonResponse);
      
        return jsonResponse;
      } catch (error) {
        console.error("Fetch completion error:", error);
        throw error; // Re-throw to be caught by XState
      }
    }),
    fetch_attitude: fromPromise(async ({input} :{input: { messages: Message[]}}) => {
      // get the last message content, send it to the model, and get the response
      // if the response is positive, return "positive"
      // if the response is negative, return "negative"
      const lastMessageContent = input.messages[input.messages.length - 1]?.content || ""; // get the last message content
      console.log("Last message content:", lastMessageContent);

      const body = {
        model: "llama3.1",
        stream: false,
        temperature: 0.1,
        prompt: `
          You are a virtual attitude detector. Determine the attitude of the user based on their latest input: "${lastMessageContent}" and respond with either "positive" or "negative" nothing else.`,
        };

      console.log("Request body:", JSON.stringify(body, null, 2)); 
      
      try {
        const response = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          body: JSON.stringify(body), 
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log("API Response:", response);

        const textResponse = await response.text();
        console.log("Text API Response:", textResponse);

        const jsonResponse = JSON.parse(textResponse).response;
        console.log("JSON API Response:", jsonResponse);
      
        return jsonResponse;
      } catch (error) {
        console.error("Fetch attitude error:", error);
        throw error; // Re-throw to be caught by XState
      }
    }),
    fetch_order_comment: fromPromise(async ({input}: {input: string}) => {
      const body = {
        model: "llama3.1",
        stream: false,
        temperature: 0.7,
        prompt: `
          Du är en vänlig snabbmatskassör. En kund har just beställt: ${input}.
          Ge en kort positiv kommentar om deras beställning (max 2 meningar) och önska dem en trevlig dag på svenska.
          
          Exempel:
          Input: två hamburgare och en cola
          Output: Utmärkt val! Våra hamburgare är verkligen populära. Ha en trevlig dag!
          
          Input: en milkshake
          Output: Vår krämiga milkshake är perfekt för en solig dag som denna. Ha det så bra!
          
          VIKTIGT: Svara utan citattecken. Skriv bara texten direkt.
          Svara med endast kommentaren, inga extra förklaringar.`
      };
    
      try {
        const response = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          body: JSON.stringify(body),
        });
    
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
    
        const textResponse = await response.text();
        const jsonResponse = JSON.parse(textResponse).response;
        // Remove any remaining quotes from the response
        const cleanResponse = jsonResponse.replace(/['"]/g, '');
        console.log("Comment Response:", cleanResponse);
        
        return cleanResponse;
      } catch (error) {
        console.error("Fetch comment error:", error);
        throw error;
      }
    }),
  },
  // guards: {
  //   actionOnce:  ({context}) => {
  //     if (context.action_counter === 0){
  //       context.action_counter +=1;
  //       return true; 
  //     }
  //     else{
  //       context.action_counter -=1;
  //       return false;
  //     }
  //   },
  //   isOfTopicFood: ({context}) => {
  //     if (!context.input) return false;
  //     const frogUtterance = context.input.toLowerCase(); // 'input' holds the frog's utterance
  //     const words = Object.keys(context.word);
  //     const sentences = Object.keys(context.sentence);

  //     // Check if frogUtterance is involved in any word with topic "food"
  //     for (const word of words) {
  //       if (word.includes(frogUtterance) && context.word[word].topic === "food") {
  //         return true;
  //       }
  //     }

  //     // Check if frogUtterance is involved in any sentence with topic "food"
  //     for (const sentence of sentences) {
  //       if (sentence.includes(frogUtterance) && context.sentence[sentence].topic === "food") {
  //         return true;
  //       }
  //     }

  //     return false;
  //   },
  //   isRightFood: ({context}) => {
  //     if (!context.input) return false;
  //     const frogUtterance = context.input; // 'input' holds the frog's utterance
  //     const rightFoodList = ["hamburgare", "milkshake", "pommes", "nuggets", "burgare"];

  //     // Check if frogUtterance is involved in any word with topic "food"
  //     return rightFoodList.some(food => frogUtterance.includes(food));
  //   },
  // },
}).createMachine({
  context: {
    action_counter: 0,
    noInputCount: 1,
    input: null,
    wordOrSentence: null,
    feature: null,
    content: null,
    word: {},
    sentence: {},
    ssRef: null as any,
    messages: [], // Added
    orders: [], // Added
    lastResponse: undefined // Added
  },
  id: "Order",
  initial: "SpeechstateSpawn",
  states: {
    "SpeechstateSpawn": {
      entry: [
        assign({
          ssRef: ({ spawn }) => spawn(speechstate, { input: settings }),
        }),
        ({ context }) => context.ssRef.send({ type: "PREPARE" }),
      ],
      on: { ASRTTS_READY: "WaitToStart" },
    },
    //Click to running
    "WaitToStart": {
      entry: {type: "ShowStartButton"},
      on: {
        CLICK: "PrepareModel",
      },
    },
    "PrepareModel":{
      invoke: {
        src: "get_ollama_models",
        onDone: {
          target: "Running",
          actions: assign(({ event }) => {
            console.log(event.output);
            return {
              availableModels: event.output.models.map((m: any) => m.name),
            };
          }),
        },
        onError: {
          actions: () => console.error("no models available"),
        },
      },
    },
    "Running": {
      initial: "Main",
      on: {ASR_NOINPUT : ".NoInput", GameOver: "#Order.GameOver", },
      states:{
        //Any NoInput inside "Main" will lead to a NoInput Prompt
        NoInput : {
          entry: [{
            type: "HandleNoInput",
            },],
          on: { 
            SPEAK_COMPLETE: [
              {
              actions: [{type: "ShowTalkButton"}], 
              target:"Main"},
              {}
            ],
            STILL_Noinput:{
              target:"#Order.GameOver.NoInputEnding"
            }
          },
        },
        Main: {
          initial: "hist",
          states:{
            Idle:{},
            hist: { type: "history", history:"deep",target: "0_4_Meeting"},
            "0_4_Meeting":{
              initial:"MeetingIntro",
              states:{
                MeetingIntro: {
                  entry: [
                    showCatshier,
                    {type: "NarratorSpeak", params:`Frog har träffat Catshier, Catshier arbetar på Wax Burger.`}
                  ],
                  on: {
                    SPEAK_COMPLETE: {
                      target: "CharacterSpeaking"
                    }
                  }
                },
                CharacterSpeaking: {
                  entry: [
                    { type: "CatshierSpeak", params: `Hej, vad kan jag göra för dig?` },
                    hideNarratorText,
                  ],
                  on: {
                    SPEAK_COMPLETE: {
                      target: "ShowUserTalkButton"
                    }
                  },
                  exit: [{type: "ShowSuggestions"}],
                },
                ShowUserTalkButton: {
                  entry: [{type: "ShowTalkButton"}],
                  on: {
                    RECOGNISED: {
                      actions: [
                        { type: "HideSuggestions" },
                        assign({ 
                          input: ({event}) => event.value[0].utterance.toLowerCase() 
                        }),
                        {type: "storeUtterance"},
                      ],
                      target: "FrogSpeakToCharacter"
                    },
                  }
                },
                FrogSpeakToCharacter: {
                  entry: [
                    // assign({
                    //   input: ({ context }) => `${context.input}`
                    // }),
                    {
                      type: "FrogSpeak",
                      params: ({ context }) => context.input || ''
                    }
                  ],
                  on: {
                    SPEAK_COMPLETE: {
                      target: "Fetch_Character_Completion"
                    }
                  },
                  exit: [{type: "HideTalkButton",}]
                },
                Fetch_Character_Completion: {
                  entry: [frogWaiting],
                  invoke: {
                    src: "fetch_completion",
                    input: ({ context }) => ({ messages: context.messages }),
                    onDone: {
                      actions: assign(({ event, context }) => {
                        let output;
                        try {
                          output = JSON.parse(event.output);
                          console.log("Parsed output:", output);
                        } catch (error) {
                          console.error("Error parsing output:", error);
                        }
                
                        const intent = output.intent;
                        const entities = output.entities;
                        console.log("Intent:", intent);
                        console.log("Entities:", entities);
                
                        if (intent === "beställning") {
                          let newOrders: Order[] = [];
                          let orderSummary = [];
                          
                          if (entities?.food) {
                            entities.food.forEach((food: any) => {
                              newOrders.push({
                                food: {
                                  item: food.item,
                                  quantity: food.quantity
                                }
                              });
                              orderSummary.push(`${food.quantity} ${food.item}`);
                            });
                          }
                          
                          if (entities?.drink) {
                            entities.drink.forEach((drink: any) => {
                              newOrders.push({
                                drink: {
                                  item: drink.item,
                                  quantity: drink.quantity
                                }
                              });
                              orderSummary.push(`${drink.quantity} ${drink.item}`);
                            });
                          }
                        
                          const finalOrderMsg = orderSummary.length > 1 
                            ? orderSummary.slice(0, -1).join(', ') + ' och ' + orderSummary.slice(-1)
                            : orderSummary[0];
                                    
                          return {
                            orders: newOrders,
                            lastResponse: `Du beställde ${finalOrderMsg}. Något annat?`,
                            messages: [...context.messages]
                          };
                        } else if (intent === "fråga_om_meny") {
                          return {
                            orders: [], // Clear any existing orders
                            lastResponse: `Javisst. Vår meny är: ${Object.values(menu).map((item) => Object.values(item)[0]).join(", ")}.`,
                            messages: [...context.messages]
                          };
                        } else if (intent === "rekommendation") {
                          CatshierHappy();
                          return {
                            orders: [], // Clear any existing orders
                            lastResponse: `Jag rekommenderar vår specialitet - Wax hamburgare med pommes frites och en milkshake. Det är vår mest populära kombination!`,
                            messages: [...context.messages]
                          };
                        } else {
                          CatshierAnnoyed();
                          return {
                            orders: [], // Clear any existing orders
                            lastResponse: `Jag förstår inte.`,
                            messages: [...context.messages]
                          };
                        }
                      }),target: "Character_Response"
                    }
                  },
                },
                Character_Response: {
                  initial: "Speaking",
                  states: {
                    Speaking: {
                      entry: [
                        { 
                          type: "CatshierSpeak", 
                          params: ({ context }) => context.lastResponse || '' 
                        }
                      ],
                      on: {
                        SPEAK_COMPLETE: {
                          target: "Deciding"
                        }
                      }
                    },
                    Deciding: {
                      always: [
                        {
                          guard: ({ context }) => context.orders && context.orders.length > 0,
                          target: "#Order.Running.Main.0_4_Meeting.ShowOrderConfirmation"
                        },
                        {
                          target: "#Order.Running.Main.0_4_Meeting.ShowUserTalkButton"
                        }
                      ]
                    }
                  }
                },
                ShowOrderConfirmation: {
                  entry: [
                    { type: "showOrderConfirmation" },
                  ],
                  on: {
                    ORDER_CONFIRMED: {
                      actions: [
                        { type: "hideOrderConfirmation" },
                        assign(({ event, context }) => ({
                          lastResponse: `Okej, så du vill ha ${event.value}. Är det rätt?`
                        })),
                      ],
                      target: "OrderConfirmed",
                    },
                    NO_ORDER: {
                      actions: [
                        { type: "hideOrderConfirmation" },
                      ],
                      target: "OrderConfirmed.NoOrder",}
                  }
                },
                OrderConfirmed: {
                  initial: "RepeatOrder",
                  states: {
                    RepeatOrder: {
                      entry: 
                        [{
                        type: "CatshierSpeak", 
                        params: ({ context }) => context.lastResponse || '' },
                        "ShowTalkButton"
                        ],
                      on: {
                        RECOGNISED: [
                          {
                            guard: ({ event }) => 
                              {const recognizedUtterance = event.nluValue;
                                return (recognizedUtterance.topIntent === 'positivt svar');
                              },
                              //action, frog speak the recognized utterance
                          actions: [
                            { type: "FrogSpeak", params: ({ event }) => event.value[0].utterance.toLowerCase() || '' },
                          ],
                            target: "OrderScuccess"
                          },
                          {
                          guard: ({ event }) => 
                            {const recognizedUtterance = event.nluValue;
                              return (recognizedUtterance.topIntent === 'negativt svar');
                            },
                          actions: [
                            { type: "FrogSpeak", params: ({ event }) => event.value[0].utterance.toLowerCase() || '' },
                          ],
                          target: "OrderFailed"
                          }
                        ]
                      },
                      exit: [{type: "HideTalkButton"}],
                    },
                    OrderScuccess: {
                      on: {
                        SPEAK_COMPLETE: {
                          actions: [frogWaiting],
                          target: "FetchComment"
                        }
                      }
                    },
                    OrderFailed: {
                      on: {
                        SPEAK_COMPLETE: {
                          actions: [frogWaiting,
                          {type: "CatshierSpeak", params: "Oj, låt mig ta din beställning igen."}],
                          target: "#Order.Running.Main.0_4_Meeting.ShowUserTalkButton"
                          },
                      }
                    },
                    NoOrder: {
                      entry: {type: "CatshierSpeak", params: "Oj, låt mig ta din beställning igen."},
                      on: {
                        SPEAK_COMPLETE: {
                          target: "#Order.Running.Main.0_4_Meeting.ShowUserTalkButton"
                        }
                      }
                    },
                    FetchComment: {
                      entry: [CatshierHappy],
                      invoke: {
                        src: "fetch_order_comment",
                        input: ({ context }) => context.lastResponse || '',
                        onDone: {
                          actions: [
                            assign({
                              lastResponse: ({ event }) => event.output
                            }),
                          ],
                          target: "FinalComment"
                        },
                        onError: {
                          target: "FinalComment",
                          actions: assign({
                            lastResponse: "Tack för din beställning! Ha en trevlig dag!"
                          })
                        }
                      }
                    },
                    FinalComment: {
                      entry: [
                        { 
                          type: "CatshierSpeak", 
                          params: ({ context }) => context.lastResponse || '' 
                        }
                      ],
                      on: {
                        SPEAK_COMPLETE: {
                          target: "#Order.GameOver.StandardEnding"
                        }
                      }
                    }
                  },
                }
              },
            },
          }
        }
      },
    },
    //stage_5: Showing results & End the game
    "GameOver": {
      initial: "StandardEnding",
      states:{
        StandardEnding: {
          on:{
            SPEAK_COMPLETE: {
              actions:[
                { type: "NarratorSpeak", params: `Spelet är över. Du hade fantastiska samtal med Grodan. Kolla in den fina Grodordbok du har skapat!`,},
                () => { hideFrogText(), hideCharacterText(), hideCatshier(), frogWithBurger()},
              ],
              target:"ShowResults"
            },
          },
        },
        ShowResults:{
          on:{
            SPEAK_COMPLETE: {
              actions:[{type: "HideTalkButton",},
                { type: "ShowFrogDict" },
                { type: "ShowStartButton" },
                hideNarratorText,
              ],
              target:"WaitingForRestart",
            }
          }
        },
        WaitingForRestart:{
          on:{
            CLICK: {
              target:"#Order.Running.Main.0_4_Meeting"
            },
          },
        },
        NoInputEnding:{
          initial:"Ending",
          states:{
            Ending: {
              entry:[{type:"NarratorSpeak", params:`Spelet är slut.`},{type: "HideTalkButton",},],
              on: {
                SPEAK_COMPLETE:{
                  actions:[{ type:"ShowStartButton" }],
                  target:"#Order.GameOver.WaitingForRestart",
                },
              }
            }
          }
        }
      },
    },
  },
});


/* Create StateMachine Actor */
export const orderMachineActor = createActor(OrderMachine).start();

orderMachineActor.subscribe((state) => {
  console.log('Order Machine State:', state);
  // Log entire state
  console.log('Current State:', state.value);
  // Log context
  console.log('Current Context:', {
    lastResponse: state.context.lastResponse,
    orders: state.context.orders
  });
});

export function setupOrderMachine(element) {
  if (!element) return;
  
  element.style.display = "block";
  const existingButton = element.querySelector("button");
  if (existingButton) {
    existingButton.remove();
  }
  
  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.innerHTML = "På restaurangen";
  startButton.addEventListener("click", () => {
    orderMachineActor.send({ type: "CLICK" });
    element.style.display = "none";
  });
  element.appendChild(startButton);
}




