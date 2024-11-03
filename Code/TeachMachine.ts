import { assign, createActor, setup, ActorRefFrom } from "xstate";
import { speechstate } from "speechstate";
//import { createBrowserInspector } from "@statelyai/inspect";
import { NLU_KEY,KEY } from "./azure";
//import { grammar_prof } from "./grammar.js";
import { showNarratorText, hideNarratorText, showFrogText, hideFrogText, showCharacterText, hideCharacterText, showCatshier, hideCatshier, frogSpeak, frogWaiting, frogWithBurger } from "./functions";

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
}
const settings: Settings = {
  azureLanguageCredentials: azureLanguageCredentials, /** global activation of NLU */
  azureCredentials: azureCredentials, 
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 4000,
  locale: "sv-SE",
  ttsDefaultVoice: "sv-SE-MattiasNeural",
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
}

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
  | { type: "SELECT", value: string };



/* Game Machine */
const TeachMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actions: {
    //Wipes out old button (if any), shows new Start button
    ShowStartButton: ({ context }) => {
      const teachElement = document.querySelector<HTMLElement>("#teach-start-button");
      const orderElement = document.querySelector<HTMLElement>("#order-start-button"); // Add this
      
      if (!teachElement) return;
    
      teachElement.style.display = "block";
      const existingStartButton = teachElement.querySelector("button");
      if (existingStartButton) {
        existingStartButton.remove();
      }
    
      const startButton = document.createElement("button");
      startButton.type = "button";
      startButton.innerHTML = "Att undervisa";
      startButton.addEventListener("click", () => {
        teachMachineActor.send({ type: "CLICK" });
        teachElement.style.display = "none";
        if (orderElement) orderElement.style.display = "none"; // Add this
      });
      teachElement.appendChild(startButton);
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
        },
      });
      showNarratorText(params);
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
          teachMachineActor.send({type: "SELECT", value: option})
        });
        element.appendChild(optionButton)
      };
      for (const option of sentence_options) {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.innerHTML = option;
        optionButton.addEventListener("click", () => {
          teachMachineActor.send({type: "SELECT", value: option})
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
        teachMachineActor.send({type: "CLICK"})
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
        teachMachineActor.send({type: "STILL_Noinput"});;
      };
    },
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
  guards: {
    actionOnce:  ({context}) => {
      if (context.action_counter === 0){
        context.action_counter +=1;
        return true; 
      }
      else{
        context.action_counter -=1;
        return false;
      }
    },
    isOfTopicFood: ({context}) => {
      if (!context.input) return false;
      const frogUtterance = context.input.toLowerCase(); // 'input' holds the frog's utterance
      const words = Object.keys(context.word);
      const sentences = Object.keys(context.sentence);

      // Check if frogUtterance is involved in any word with topic "food"
      for (const word of words) {
        if (word.includes(frogUtterance) && context.word[word].topic === "food") {
          return true;
        }
      }

      // Check if frogUtterance is involved in any sentence with topic "food"
      for (const sentence of sentences) {
        if (sentence.includes(frogUtterance) && context.sentence[sentence].topic === "food") {
          return true;
        }
      }

      return false;
    },
    isRightFood: ({context}) => {
      if (!context.input) return false;
      const frogUtterance = context.input; // 'input' holds the frog's utterance
      const rightFoodList = ["hamburgare", "milkshake", "pommes", "nuggets", "burgare"];

      // Check if frogUtterance is involved in any word with topic "food"
      return rightFoodList.some(food => frogUtterance.includes(food));
    },
  },
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
    ssRef: null as any, // Will be assigned during SpeechstateSpawn
  },
  id: "Teach",
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
        CLICK: "Running",
      },
    },
    "Running": {
      initial: "Main",
      on: {ASR_NOINPUT : ".NoInput", GameOver: "#Teach.GameOver", },
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
              target:"#Teach.GameOver.NoInputEnding"
            }
          },
        },
        Main: {
          initial: "hist",
          states:{
            Idle:{},
            hist: { type: "history", history:"deep",target: "0_1_Greeting"},
            //stage_0: Greeting
            "0_1_Greeting": {
              initial: "GreetingIntro",
              states:{
                //Greeting Introducing Frog & Show Talk button 
                GreetingIntro: {
                  entry: [{type: "HideResults",}, {type:"NarratorSpeak", params:`Du träffade Frog! Frog vill lära sig svenska av dig. Kan du börja med en trevlig hälsning?`}, 
                  ], 
                  on: 
                    {SPEAK_COMPLETE: "ListenToGreeting"},
                },
                //Listen to the greeting, store the greeting sentence, hide the talk button
                ListenToGreeting: {
                  entry: [{type: "ShowTalkButton"}],
                  on: {
                    RECOGNISED: {
                      actions:[
                        assign({ input: ({event}) => event.value[0].utterance.toLowerCase() }),
                        ({ context }) => {
                          const wordOrSentence = "sentence";
                          const newSentence = context.input;
                          const feature = "topic";

                          // Store the new sentence
                          if (wordOrSentence && newSentence){
                          const content = "greeting";
                          context[wordOrSentence] = context[wordOrSentence] || {};
                          context[wordOrSentence][newSentence] = { [feature]: content};
                          }
                          // type: "FrogLearn",
                          // data: {
                          //   wordOrSentence: "sentence",
                          //   newSentence: context.input,
                          //   feature: "topic",
                          //   content: "greeting",
                          // },
                        },
                        ({context}) => console.log(context),
                      ],
                      target: "ConfirmGreeting",
                    },
                  },
                  exit: [{type: "HideTalkButton",}]
                },
                //Stores the "greeting" and judges it
                ConfirmGreeting: {
                  entry: [{type: "NarratorSpeak", params:`Bra sagt! Låt oss se om Frog har plockat upp det.`},],
                  on: {
                    SPEAK_COMPLETE: {
                      actions: [
                        ({ context }) => {
                          const sentenceKeyWithGreeting = Object.keys(context.sentence).find(
                            key => context.sentence[key].topic === "greeting");
                            console.log("Sentence key with greeting:", sentenceKeyWithGreeting); 
                          const params = `Grodan pratar: "${
                            sentenceKeyWithGreeting
                          }".`;
                          showFrogText(params);
                          frogSpeak();
                          context.ssRef.send({
                            type: "SPEAK",
                            value: {
                              utterance: params,
                            },
                          });
                          },
                      ],
                      target:"#Teach.Running.Main.0_2_WordTeaching",
                    },
                  },
                },
            },
            },
            "0_2_WordTeaching": {
              initial: "WordIntro",
              states:{
                WordIntro:{
                  on: {
                    SPEAK_COMPLETE: {
                      actions:[ 
                        frogWaiting, 
                        hideFrogText,
                        {type:"NarratorSpeak", params:`Låt oss försöka lära ut. Hur är det med ett ord om mat?`},
                      ],
                      target:"WordShowTalk",
                    },
                  },
                },
                WordShowTalk:{
                  on: {
                    SPEAK_COMPLETE: {
                      actions:[ 
                        {type: "ShowTalkButton"}
                      ],
                      target:"WordListen",
                    },
                  },
                },
                WordListen:{
                  on:{
                    RECOGNISED: {
                      actions:[
                        assign({ input: ({event}) => event.value[0].utterance.toLowerCase() }),
                        ({ context }) => {
                          const wordOrSentence = "word";
                          const newWord = context.input;
                          const feature = "topic";
                          const content = "food";
                          if (wordOrSentence && newWord){
                            context[wordOrSentence] = context[wordOrSentence] || {};
                            context[wordOrSentence][newWord] = { [feature]: content};
                          }
                        },
                        ({context}) => console.log(context),
                      ],
                      target:"WordConfirm",
                    },
                  },
                  exit: [{type: "HideTalkButton",}]
                },
                WordConfirm:{
                  entry: [{type: "NarratorSpeak", params:`Mums! Låt oss se om Frog har plockat upp det.`},],
                  on: {
                    SPEAK_COMPLETE: {
                      actions: [
                        ({ context }) => {
                            const wordKeyWithFood = context.input;
                            const params = `Frog talar: "${
                              wordKeyWithFood
                            }".`;
                            showFrogText(params);
                            frogSpeak();
                            context.ssRef.send({
                              type: "SPEAK",
                              value: {
                                utterance: params,
                              },
                            });
                          },
                      ],
                      target:"#Teach.Running.Main.0_3_ReadyForMeeting",
                    },
                  },
                }, 
              },
            },
            "0_3_ReadyForMeeting":{
              initial:"MeetIntro",
              states:{
                MeetIntro:{
                  on: {
                    SPEAK_COMPLETE: {
                      actions:[ 
                        frogWaiting, 
                        hideFrogText,
                        {type:"NarratorSpeak", params:`Bra gjort! Nu vill Frog prova det språk den har lärt sig! Är vi redo för detta?`},
                      ],
                      target:"MeetDeciding",
                    },
                  },
                },
                MeetDeciding: {
                  on:{
                    SPEAK_COMPLETE: {
                      actions:[ 
                        {type: "ShowTalkButton"}
                      ],
                      target:"MeetDecided",
                    },
                  }
                },
                MeetDecided: {
                  on:{
                    RECOGNISED: [
                      {
                        guard: ({ event }) => 
                          {const recognizedUtterance = event.nluValue;
                            console.log(recognizedUtterance);
                          return ( recognizedUtterance.topIntent === 'positivt svar');
                          },
                        actions:[ {type: "HideTalkButton",},
                          {type:"NarratorSpeak", 
                          params:`Okej, Frog är redo att gå.`}
                        ],
                        target:"#Teach.Running.Main.0_4_Meeting",
                      },
                      {
                        guard: ({ event }) => 
                        {const recognizedUtterance = event.nluValue;
                          console.log(recognizedUtterance);
                        return ( recognizedUtterance.topIntent === 'negativt svar');
                        },
                      actions:[ {type: "HideTalkButton",},
                        {type:"NarratorSpeak", 
                          params:`Jag håller med. Låt oss lära ut mer.`}
                      ],
                      target:"#Teach.Running.Main.0_5_TeachMore",
                      },
                    ],
                  },
                }
              },
            },
            "0_4_Meeting":{
              initial:"MeetingIntro",
              states:{
                MeetingIntro:{
                  on:{
                    SPEAK_COMPLETE: {
                      actions: [showCatshier,{type: "NarratorSpeak", params:`Frog har träffat Catshier, Catshier arbetar på Wax Burger.`}],
                      target:"CharacterSpeaking",
                    },
                  },
                },
                CharacterSpeaking:{
                  on: {
                    SPEAK_COMPLETE: {
                      actions: [ 
                      ({ context }) => {
                        const params = `Catshier säger: 'Hej, vad kan jag göra för dig?`;
                        showCharacterText(params);
                        context.ssRef.send({
                          type: "SPEAK",
                          value: {
                            utterance: params,
                          },
                        });
                      },
                      hideNarratorText,
                      ],
                      target:"ChooseSpeech",
                    },
                  },
                },
                ChooseSpeech:{
                  on:{
                    SPEAK_COMPLETE: {
                      actions:[ { type:"ShowButton"}, {type:"ShowTeachMoreButton",}],
                      target: "FrogSpeakToCharacter",
                    },
                  },
                },
                FrogSpeakToCharacter:{
                  on:{
                    SELECT: {
                      actions: [
                        ({ context,event }) => {
                          const params = `Frog pratar: "${event.value}"`;
                          showFrogText(params);
                          frogSpeak();
                          context.ssRef.send({
                            type: "SPEAK",
                            value: {
                              utterance: params
                            },
                          });
                          // Save the frog speech to "input"
                          context.input = event.value;
                        },
                        {type: "RemoveButtons"},
                        {type: "RemoveTeachMoreButton"},
                      ],
                      target: "WaitForCharacterResponse",
                    },
                    // Send to "Teach More" stage if "TeachMore" is CLICKed
                    CLICK: {
                      actions: [
                      {type:"NarratorSpeak", params:`Bra idé. Låt oss lära ut mer.`},
                      {type: "RemoveButtons"}, 
                      hideFrogText, 
                      hideCharacterText,
                      hideCatshier,
                      {type: "RemoveTeachMoreButton"}],
                      target: "#Teach.Running.Main.0_5_TeachMore"
                    },
                  },
                },
                WaitForCharacterResponse:{
                  on:{
                    SPEAK_COMPLETE: [
                      {
                        guard: {type: "isRightFood"},
                        actions: [
                          ({ context }) => {
                            const params = `Catshier säger: 'Självklart! Här är din beställning. Ha en trevlig dag!`;
                            showCharacterText(params);
                            frogWaiting();
                            context.ssRef.send({
                              type: "SPEAK",
                              value: {
                                utterance: params,
                              },
                            });
                          },
                        ],
                        target: "#Teach.GameOver.StandardEnding",
                      },
                      {
                        guard: {type: "isOfTopicFood"},
                        actions: [
                          ({ context }) => {
                            const params = `Catshier säger: 'Förlåt, vi säljer inte det här. Vi erbjuder hamburgare, milkshake, pommes frites och fisknuggets.`;
                            showCharacterText(params);
                            frogWaiting();
                            context.ssRef.send({
                              type: "SPEAK",
                              value: {
                                utterance: params,
                              },
                            });
                          },
                        ],
                        target: "#Teach.Running.Main.0_4_Meeting.ChooseSpeech",
                      },
                      { actions: [({ context }) => {
                          const params = `Catshier säger: 'Så vad vill du beställa?`;
                          showCharacterText(params);
                          frogWaiting();
                          context.ssRef.send({
                            type: "SPEAK",
                            value: {
                              utterance: params,
                            },
                          });
                        },
                        ],
                        target: "#Teach.Running.Main.0_4_Meeting.ChooseSpeech",}
                    ],
                  },
                },
              },
            },
            "0_5_TeachMore":{
              initial: "Intro",
              states:{
                Intro:{
                  on: {
                    SPEAK_COMPLETE: {
                      actions:[
                        {type:"NarratorSpeak", params:`Lär vi oss ett ord?`},
                      ],
                      target:"wordOrSentenceDeciding",
                    },
                  },
                },
                wordOrSentenceDeciding:{
                  on:{
                    SPEAK_COMPLETE: {
                      actions:[ 
                        {type: "ShowTalkButton"}
                      ],
                      target:"wordOrSentenceDecided",
                    },
                  }
                },
                wordOrSentenceDecided:{
                  on:{
                    RECOGNISED: [
                      { //if learning a "word"; then ask for "topic" name (e.g. Food)
                        guard: ({ event }) => 
                          {const recognizedUtterance = event.nluValue;
                            console.log(recognizedUtterance);
                          return ( recognizedUtterance.topIntent === 'positive response');
                          },
                        actions:[ assign({ wordOrSentence: () => "word" }),
                        {type:"NarratorSpeak", params:`Vilket ämne handlar det om?`},
                        {type: "HideTalkButton",},
                        ],
                        target:"topicDeciding",
                      },
                      { 
                        actions:[ assign({ wordOrSentence: () => "sentence" }),
                        {type:"NarratorSpeak", params:`Vilket ämne handlar det om?`},
                        {type: "HideTalkButton",},
                        ],
                        target:"topicDeciding",
                      },
                    ],
                  },
                },
                topicDeciding:{
                  on:{
                    SPEAK_COMPLETE: {
                      actions:[ 
                        {type: "ShowTalkButton"}
                      ],
                      target:"topicDecided",
                    },
                  }
                },
                topicDecided:{
                  on:{
                    RECOGNISED: [
                      { //store the "topic" name (e.g. Food)
                        actions:[ assign({ content: ({ event }) => event.value[0].utterance.toLowerCase() },),
                          {type:"NarratorSpeak", params:`Vad är ordet eller meningen nu?`},
                          {type: "HideTalkButton",}
                        ],
                        target:"inputDeciding",
                      },
                    ],
                  },
                },
                inputDeciding:{
                  on:{
                    SPEAK_COMPLETE: {
                      actions:[ 
                        {type: "ShowTalkButton"}
                      ],
                      target:"inputDecided",
                    },
                  }
                },
                inputDecided:{
                  on:{
                    RECOGNISED: [
                      { //store the input (e.g. "ice cream")
                        actions:[ assign({ input: ({ event }) => event.value[0].utterance.toLowerCase()},),
                          {type: "NarratorSpeak", params:`Bra! Låt oss se om Grodan har plockat upp det.`},
                          {type: "HideTalkButton",}],
                        target:"FrogRepeat",
                      },
                    ],
                  },
                },
                FrogRepeat:{
                  on: {
                    SPEAK_COMPLETE: {
                      actions: [
                        ({ context }) => {
                            const params = `Frog speaking: "${
                              context.input
                            }".`;
                            showFrogText(params);
                            frogSpeak();
                            context.ssRef.send({
                              type: "SPEAK",
                              value: {
                                utterance: params,
                              },
                            });
                          },
                      ],
                      target:"Confirm",
                    },
                  },
                }, 
                Confirm:{
                  on: {
                    SPEAK_COMPLETE: {
                      actions: [()=> {frogWaiting(); hideFrogText();},
                        {type: "NarratorSpeak", params:`Var det rätt?`},
                        {type: "ShowTalkButton"}
                      ],
                      target:"ResultOfConfirm",
                    },
                  },
                }, 
                ResultOfConfirm: {
                  on:{
                    RECOGNISED: [
                      { //if learning a "word"; then ask for "topic" name (e.g. Food)
                        guard: ({ event }) => 
                          {const recognizedUtterance = event.nluValue;
                            console.log(recognizedUtterance);
                          return ( recognizedUtterance.topIntent === 'positivt svar');
                          },
                        actions:[ 
                          ({ context }) => {
                          const wordOrSentence = context.wordOrSentence;
                          const input = context.input;
                          const feature = "topic";
                          const content = context.content;
                          if (wordOrSentence && input && feature && content){
                            context[wordOrSentence] = context[wordOrSentence] || {};
                            context[wordOrSentence][input] = {[feature]: content};
                          }
                          },
                          {type: "NarratorSpeak", params:`Bra!`},
                          {type: "HideTalkButton",}
                        ],
                        target:"#Teach.Running.Main.0_3_ReadyForMeeting.MeetIntro",
                      },
                      { 
                        actions:[
                        {type:"NarratorSpeak", params:`Jag förstår. Låt oss göra det igen.`},
                        {type: "HideTalkButton",}
                        ],
                        target:"#Teach.Running.Main.0_5_TeachMore",
                      },
                    ],
                  },
                },
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
              target:"#Teach.Running.Main.0_1_Greeting"
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
                  target:"#Teach.GameOver.WaitingForRestart",
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
const teachMachineActor = createActor(TeachMachine, {
  //inspect: inspector.inspect,
}).start();

teachMachineActor.subscribe((state) => {
  console.log ( 'Teach Machine State:',state )
}); 

export function setupTeachMachine(element) {
  if (!element) return;
  
  element.style.display = "block";
  const existingButton = element.querySelector("button");
  if (existingButton) {
    existingButton.remove();
  }
  
  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.innerHTML = "Att undervisa";
  startButton.addEventListener("click", () => {
    teachMachineActor.send({ type: "CLICK" });
    element.style.display = "none";
  });
  element.appendChild(startButton);
}




