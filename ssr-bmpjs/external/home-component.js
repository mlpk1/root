

/** @jsx BMPVD.createBMPVirtulaDOMElement */
import { BmpRouter } from 'bmp-router'
import { BMPVD, BMPVDWebComponent, bmpCssInstance } from 'bmp-core'

import { testUtil } from './utils.js'

let homeStyles = bmpCssInstance.define({
	name: 'home-component',
	cssjs: { display: 'block', padding: '10px 10px' }
})

class HomeComponent extends BMPVDWebComponent {

  onAttached() {
		// some code goes here
		testUtil()
  }

	ready() {
		homeStyles.attachStyles(this)
	}

  render() {
    return BMPVD.createBMPVirtulaDOMElement(
			"div",
			{ class: 'component', onclick: function() { alert('hello') } },
			BMPVD.createBMPVirtulaDOMElement( 'h2', null, "Hello from home component" ),
			BMPVD.createBMPVirtulaDOMElement(
				'div', { dynamicprop: testUtil() }, BMPVD.createBMPVirtulaDOMElement('test-component')
			)
		)
  }

}
customElements.define( 'home-component', HomeComponent )


let testStyles = bmpCssInstance.define({
	name: 'test-component',
	cssjs: { display: 'block', padding: '20px 10px' }
})
class TestComponent extends BMPVDWebComponent {

  onAttached() {
	}

	ready() {
		testStyles.attachStyles(this)
	}


  render() {
    return (
      BMPVD.createBMPVirtulaDOMElement(
        "div",
        { class: 'component', onclick: function() { alert('hello') } },
        'Hello from test component'
      )
    )
  }

}
customElements.define( 'test-component', TestComponent )

