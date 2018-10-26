/** Little error helper for required function arguments*/
const req = name => { throw new Error( `${name} required parameter` ) }

/** General proto of the css component instance
 * @constructor
 */
function CssComponent () {
  /** this.selectors strores all selecors for css component
   * ex.: { 'class': [ 'value', 'value' ], 'id': 'value', 'some-attr': 'value' }
   */
  this.selectors = {}

  /** Adding selector to instance of css component
   * @param { String } type
   * @param { String } selector
   */
  const regSelector = ({ type = req('type'), selector = req('selector') }) => {
    if ( !this.selectors.hasOwnProperty( type ) ) this.selectors[ type ] = type === 'class' ? [] : ''

    if ( type == 'class' ) this.selectors[ type ].push( selector )
    else this.selectors[ type ] = selector
  }
  return {
    selectors: this.selectors,
    regSelector: regSelector,
  }
}

/** Generates CSS Selector */
const asCssSelector = ( str = req('string for css selector'), type = req('type of css selector')) => {
  switch (type) {
    case 'class':
      return `.${str}`
      break
    case 'id':
      return `#${str}`
      break

    default:
      return `[${type}="${str}"]`
      break;
  }
}

/** Appending css selectors to a given dom element
   * @param { HTMLElement } domElement
   * @param { Object } selectorObject (ex.: { 'class': [ 'value', 'value' ], 'id': 'value', 'some-attr': 'value' })
  */
const _addSelectors = ( domElement = req('domElement'), selectorObject = req('selectorObject')) => {
  // console.log( domElement, selectorObject )
  Object.keys( selectorObject ).forEach( type => {
    if ( type === 'class' )
      domElement.classList.add( ...selectorObject[ type ])
    else
      domElement.setAttribute( selectorObject.type, selectorObject[ type ])
  })
}


/** BmpCss is the entry point of the runtyme js to css transforming logic
 * Start by instantiate BmpCss in your app
 * ex.: const myBmpCss = new BmpCss()
 * it'll gave you instance with following functionalities
 */
class BmpCss {
  constructor () {
    this.componentsRegistry = {}
    this.uniqs = []
  }

  /** Walk through css component attrs and appends each to domElement as selectors
   * @param { HTMLElement } domElement
   * @param { String } componentName
   */
  _attachStyles ( domElement = req('domElement'), componentName = req('component name')) {
    Object.keys( this.componentsRegistry[ componentName ].selectors ).forEach( type => {
      _addSelectors( domElement, { [type]: this.componentsRegistry[ componentName ].selectors[ type ] })
    })
  }

  /** Adding component styles.
   * Use it to add new component styles to BMPCSS
   * @param { String } name Component Name (usually a tag name)
   * @param { Object } cssjs JS Object representing css
   *  ex.: {
   *    '.buttonClassName': {
   *      background: 'red',
   *      'span': {
   *        'color': 'white'
   *      }
   *    }
   * })
   * @param { String } [type] type of the css selector default 'class'
   * @param { String } [prefix] namespace prefix
   * @returns { Object } css component instance
   */
  define ({ name = req('name'), cssjs = req('cssjs'), type = 'class', prefix = 'bmp' }) {
    if ( this.componentsRegistry.hasOwnProperty( name ))
      return this.componentsRegistry[ name ]

    /** Gen uniq selector and register new component */
    let uniqSelector = this.genUniqSelector( prefix )
    this.componentsRegistry[ name ] = new CssComponent()
    this.componentsRegistry[ name ].regSelector({ type: type, selector: uniqSelector })

    this.componentsRegistry[ name ].extend = ( toextend ) => this.extend({ toextend, extender: this.componentsRegistry[ name ] })
    this.componentsRegistry[ name ].attachStyles = ( domElement = req('HTMLElement')) => this._attachStyles( domElement, name )

    /** Creating css tag and populate it with css/text generated from js css representation */
    let styleTag = document.createElement( 'style' )
    styleTag.type = 'text/css'
    styleTag.appendChild(
      document.createTextNode(
        this.transform( `${asCssSelector(uniqSelector, type)}`, cssjs )
		))
		let firstScript = document.querySelector('head > style')
		if ( !firstScript )
			document.head.appendChild( styleTag )
		else
			document.head.insertBefore( styleTag, firstScript )

    return this.componentsRegistry[ name ]
  }

  /** Extend styles from existed component
   * @param { String } toextend
   * @param { String } extender
   * @return { Class }
   */
  extend ({ toextend = req( 'toextend' ), extender = req( 'extender' ) }) {
    if ( !this.componentsRegistry.hasOwnProperty( toextend )) throw new Error( `${toextend} css component not defined` )

    Object.keys( this.componentsRegistry[ toextend ].selectors ).forEach( type => {
      if ( type === 'class' )
        this.componentsRegistry[ toextend ].selectors[ type ].forEach( selector => {
          extender.regSelector({ type, selector })
        })
      else extender.regSelector({ type, selector })
    })

  }

  /** Random selector with cuctom prefix
   * @param { String } prefix
   * @returns { String } generated uniq string
   */
  genUniqSelector ( prefix = req('prefix') ) {
    /** TODO change {Math.random().toString(36).substr(2, 5)} copy-past */
    let selector = `${prefix}-${Math.random().toString(36).substr(2, 5)}`
    if ( this.uniqs.indexOf( selector ) >= 0 )
      return this.genUniqSelector()

    this.uniqs.push( selector )
    return selector
  }

  /** Generates css/text */
  transform ( uniqSelector, pretransformed ) {
		pretransformed = this._pretransformCSSJStoCSS({ selector: uniqSelector, cssjs: pretransformed })
    const _tr = preCss => Object.keys( preCss ).reduce(( output, iter ) => {
      if ( /^\@/.test( iter ))
        return `${output}${iter}{${_tr(preCss[iter])}}`
      else
        return `${output}${iter}${ preCss[iter] }`
		}, '')
    return _tr( pretransformed )
	}

	/**
	 * glue of parent selector and raw variant like scss
	 * @example:
	 * 	selector: '.parent'
	 * 	"&.hidden" -> .parent.hidden
	 * 	".hidden, .visible" -> .parent .hidden, .parent .visible
	 * 	".hidden, &.visible" -> .parent .hidden, .parent.visible
	 */
	//
	//
	glue(parent, rawSelector) {
		return rawSelector.split(',').map( selector => {
			// add parent to all separated selectors
			return `${ parent }${ selector.includes('&') ? selector.replace('&', '') : ` ${selector}`}`
		}).join(',')
	}

  /** pretranspile js object to text/css
   * @param { String } parantCssSelector
   * @param { Object } styleSheetObject
   * @returns { String } ex.: `
   *  '.buttonClassName': '{background: red;}'
   *  '.buttonClassName span': '{color: white;}'
   * `
   */
  _pretransformCSSJStoCSS ({ selector = this.genUniqSelector('bmp'), cssjs = {} }) {

    return Object.keys( cssjs ).reduce(( output, iter ) => {
      if ( typeof cssjs[ iter ] === 'object') {
				// insert new CSS block with rules as object ex.: selector: " ...rules"
				if ( /^\@/.test( iter ) ) {
					return {
						...output,
						[iter.trim()]: this._pretransformCSSJStoCSS({
							selector: selector,
							cssjs: cssjs[ iter ]
						})
					}
				} else {
					return {
						...output,
						...this._pretransformCSSJStoCSS({
							selector: this.glue(selector, iter),
							cssjs: cssjs[ iter ],
						})
					}
				}

      } else {
        // insert new rule ex.: background: 'red'
        if ( !output.hasOwnProperty( selector ))
          output[selector] = '{}'

				output[selector] = output[selector].replace( '}', `${iter}: ${String( cssjs[ iter ] ).trim() == "" ? '""' : cssjs[ iter ] };}` )
			}
			return output
    }, {})
  }
}

export { BmpCss }
