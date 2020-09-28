function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TikZPicture extends HTMLElement {
  STYLE = `h3{margin:0}.flex{display:flex}.flex-col{flex-direction:column}.items-center{align-items:center}.w-full{width:100%}.h-full{height:100%}.mt-6{margin-top:1.5rem}.font-bold{font-weight:700}.text-xl{font-size:1.25rem}.tikz-loading{display:flex;width:100%;height:100%;justify-content:center;align-items:center}.tikz-loaded .tikz-loading{display:none}.tikz-image-wrapper{display:none}.tikz-loaded .tikz-image-wrapper{display:flex;width:100%;max-width:42rem;height:100%}.tikz-loaded.tikz-error .tikz-image-wrapper{display:none}.tikz-error-wrapper{display:none}.tikz-loaded.tikz-error .tikz-error-wrapper{display:block;width:100%;max-width:42rem;height:100%;overflow-y:auto;box-sizing:border-box;padding:0 1.5rem}.tikz-error pre{font-size:.9rem;max-width:42rem;padding:.7rem 0 1.5rem;word-break:break-all;white-space:break-spaces}`;
  MAX_RETRY = 50;
  TIMEOUT = 700;

  retry = 0;

  constructor() {
    super();

    // Create a shadow root
    this.attachShadow({ mode: "open" });

    this.source = this.innerHTML
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s)
      .join("\n");

    // Create (nested) span elements
    const wrapper = document.createElement("div");
    wrapper.setAttribute("class", "flex flex-col items-center");
    wrapper.setAttribute("style", this.getAttribute("style") ?? '');
    wrapper.style.height = this.getAttribute("height") ?? "20rem";
    this.wrapper = wrapper;

    const loading = wrapper.appendChild(document.createElement("div"));
    loading.setAttribute("class", "tikz-loading");
    loading.textContent = "Loading...";
    this.loading = loading;

    const imageWrapper = wrapper.appendChild(document.createElement("div"));
    imageWrapper.setAttribute(
      "class",
      "tikz-image-wrapper w-full h-full flex flex-col items-center"
    );
    this.imageWrapper = imageWrapper;

    const image = imageWrapper.appendChild(document.createElement("img"));
    image.style.height = "100%";
    image.style.width = "auto";
    this.image = image;

    const errorWrapper = wrapper.appendChild(document.createElement("div"));
    errorWrapper.setAttribute("class", "tikz-error-wrapper");
    this.errorWrapper = errorWrapper;

    const errorHeading = errorWrapper.appendChild(document.createElement("h3"));
    errorHeading.setAttribute("class", "mt-6 font-bold text-xl");
    errorHeading.innerText = "An error occurred:";
    this.errorHeading = errorHeading;

    const errorPre = errorWrapper.appendChild(document.createElement("pre"));
    this.errorPre = errorPre;

    // Create some CSS to apply to the shadow dom
    const style = document.createElement("style");
    style.textContent = this.STYLE;

    // attach the created elements to the shadow DOM
    this.shadowRoot.append(style, wrapper);

    this.fetch();
  }

  async fetch() {
    const response = await fetch("https://admin.math1.org/api/tikz", {
      method: "POST",
      body: JSON.stringify({
        source: this.source,
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 202) {
      await this.tryFetch((await response.json()).hash);
    } else if (response.status === 409) {
      const { hash } = await response.json();
      console.log("hash:", hash);
      await fetch(`https://admin.math1.org/api/tikz/${hash}`);
      this.setImageSrc(hash);
    } else if (response.status === 400) {
      this.setError((await response.json()).error);
    } else {
      this.setError("Internal server error");
    }
  }

  async tryFetch(hash) {
    const response = await fetch(
      `https://admin.math1.org/api/tikz/status/${hash}`
    );
    if (response.status === 404 && this.retry < this.MAX_RETRY) {
      // not yet created
      await delay(this.TIMEOUT);
      this.retry++;
      return this.tryFetch(hash);
    }
    if (response.status === 200) {
      this.setImageSrc(hash);
    } else if (response.status === 400) {
      this.setError((await response.json()).error);
    } else {
      this.setError("Internal server error");
    }
  }

  setImageSrc(hash) {
    this.image.src = `https://admin.math1.org/api/tikz/${hash}`;
    this.markLoaded();
  }

  setError(error) {
    this.errorPre.innerHTML = error;
    this.markLoaded();
    this.markError();
  }

  markLoaded() {
    this.wrapper.classList.add("tikz-loaded");
  }

  markError() {
    this.wrapper.classList.add("tikz-error");
  }
}

customElements.define("tikz-picture", TikZPicture);
