
import { Template } from 'bmp-core'

import { elem, text } from '../theme/index.js'

class Footer extends Bmp.CustomElement {

	static get tag() {
		return 'bmp-footer'
	}

	ready() {

	}


	build() {
		return `
			<p>Footer</p>
		`
	}

}

export { Footer }
