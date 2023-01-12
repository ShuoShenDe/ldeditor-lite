
import ReactDOM from "react-dom";

const rootEl = document.getElementById("root");

console.log("Hello log")
// var mountNode = document.getElementById("app");
// ReactDOM.render(<head>Hello word</head>, mountNode);
async function main() {
    const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+)\./);
    const chromeVersion = chromeMatch ? parseInt(chromeMatch[1] ?? "", 10) : 0;
    const isChrome = chromeVersion !== 0;
  
    const canRenderApp = typeof BigInt64Array === "function" && typeof BigUint64Array === "function";

  
    if (!canRenderApp) {
      ReactDOM.render(
          <head>"Can not render App"</head>,
           rootEl,
      );
      return;
    }
  
    const { installDevtoolsFormatters, overwriteFetch, waitForFonts } = await import(
      "@foxglove/studio-base"
    );
    installDevtoolsFormatters();
    overwriteFetch();
    // consider moving waitForFonts into App to display an app loading screen
    await waitForFonts();
  
  
    ReactDOM.render(
      <h1>
        "Hello Web LDEditor"
      </h1>,
      rootEl,
    );
  }
  
  void main();