
import { HTMLElement } from './html-element'
import { customElements } from './custom-elements'

class HTMLDocument extends HTMLElement {

	constructor(baseURI) {
		super()
		this.body = new HTMLElement('body', {}, this)
		this.head = new HTMLElement('head', {}, this)
		this.baseURI = baseURI || ""
	}

	set title(content) {
		let titleElement = this.head.childNodes.find( child => child.tagName === 'title' )
		if ( !titleElement ) {
			titleElement = new HTMLElement('title', {}, this)
			titleElement.innerHTML
			this.head.appendChild(titleElement)
		}
		titleElement.innerHTML = content
	}

	get title() {
		const el = this.head.childNodes.find( el => el.tagName === 'title' )
		return el ? el.innerHTML : ''
	}

	createTextNode(content) {
		return String(content)
	}

	getElementsByTagName(tagname) {
		if (tagname == 'script')
			return this.head.childNodes
		return []
	}

	getElementById() {
		return new HTMLElement('div')
	}

	/**
	 * calls static createElement method
	 * @param tag
	 */
	createElement(tag) {
		return HTMLDocument.createElement(tag)
	}

	/**
	 * Creates instnace of customElement or HTMLElement
	 * @param tagName tag of element
	 * @param attrs attributes of element
	 * @return { HTMLElement|BMPVDWebComponent } component
	 */
	static createElement(tag) {
		const CustomElement = customElements.get(tag)
		if (CustomElement) {
			const instance = new CustomElement.constructor(tag)
			instance.tagName = tag
			return instance
		} else {
			return new HTMLElement(tag)
		}
	}

	get implementation() {
		return {
			createHTMLDocument: () => {
				return new HTMLDocument()
			}
		}
	}

}

export { HTMLDocument }
