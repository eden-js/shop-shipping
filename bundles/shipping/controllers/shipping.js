
// require dependencies
const Controller = require('controller');

// require dependencies
const Address = model('address');

/**
 * build example dameon class
 *
 * @mount /shipping
 */
class ShippingController extends Controller {
  /**
   * construct example daemon class
   */
  constructor() {
    // run super eden
    super();

    // bind methods
    this.build = this.build.bind(this);

    // bind private methods
    this._order = this._order.bind(this);
    this._address = this._address.bind(this);
    this._invoice = this._invoice.bind(this);
    this._checkout = this._checkout.bind(this);
    this._sanitise = this._sanitise.bind(this);

    // build shipping daemon
    this.build();
  }

  /**
   * build shipping daemon
   */
  build() {
    // checkout hooks
    this.eden.pre('checkout.init', this._checkout);

    // order hooks
    this.eden.pre('order.init', this._order);
    this.eden.pre('order.address', this._address);
    this.eden.pre('order.invoice', this._invoice);
    this.eden.pre('order.shipping', this._shipping);
    this.eden.pre('order.sanitise', this._sanitise);

    // order submit
    this.eden.pre('order.submit', this._submit);
  }

  /**
   * checkout order
   *
   * @param  {Object} order
   */
  async _checkout(order) {
    // add action
    order.set('actions.address', {
      type : 'address',
      data : {
        addresses : await Promise.all((await Address.find({
          'user.id' : order.get('user.id'),
        })).map((address) => {
          // return sanitised address
          return address.sanitise();
        })),
      },
      priority : 15,
    });

    // add action
    order.set('actions.shipping', {
      type     : 'shipping',
      data     : {},
      priority : 20,
    });
  }

  /**
   * checkout order
   *
   * @param  {order} Order
   */
  async _order(order) {
    // check found
    if (!order.get('actions.address') && !(order.get('skip') || []).includes('address')) {
      order.set('error', {
        id   : 'shipping.noaddress',
        text : 'Order is missing address',
      });
    }
  }

  /**
   * on address
   *
   * @param  {order}  Order
   * @param  {Object} action
   *
   * @return {Promise}
   */
  async _address(order, action) {
    // check error
    if (order.get('error')) return null;

    // check address
    if (!action.value || (typeof action.value === 'object' && (!action.value.address || !Object.keys(action.value.address)))) {
      // skip on address
      if ((order.get('skip') || []).includes('address')) return null;

      // set error
      return order.set('error', {
        id   : 'shipping.noaddress',
        text : 'Order is missing address',
      });
    }

    // check address
    let address = typeof action.value === 'string' ? await Address.findById(action.value) : null;

    // check address
    if (!address) {
      // check if save
      if (action.value.save && await order.get('user')) {
        // set address
        address = new Address(action.value.address);

        // set fields
        Object.keys(action.value).forEach((key) => {
          // continue on address
          if (key === 'address') return;

          // set value
          address.set(key, action.value[key]);
        });

        // set name
        address.set('user', await order.get('user'));

        // save address
        await address.save(await order.get('user'));
      } else {
        // set address
        // eslint-disable-next-line prefer-destructuring
        address = action.value.address;

        // loop
        Object.keys(action.value).forEach((key) => {
          // continue
          if (key === 'address') return;

          // set address value
          address[key] = action.value[key];
        });
      }
    }

    // set order address
    order.set('address', address);

    // save
    return await order.save(await order.get('user'));
  }

  /**
   * on shipping
   *
   * @param  {order}   Order
   * @param  {Object}  action
   *
   * @return {Promise}
   */
  async _invoice(order, invoice) {
    // augment order
    const action = order.get('actions.shipping');

    // log
    if (action && action.value && action.value.amount) invoice.set('total', invoice.get('total') + parseFloat(action.value.amount));
  }

  /**
   * on shipping
   *
   * @param  {order}   Order
   * @param  {Object}  action
   *
   * @return {Promise}
   */
  async _shipping(order, action) {
    // add shipping price
    action.value = {
      amount : 0,
    };
  }

  /**
   * on admin submit order
   *
   * @param  {request}  req
   * @param  {order}    Order
   *
   * @return {Promise}
   */
  async _submit(req, order) {
    // set status
    if (!order.get('shipped') && req.body.shipped === 'true') order.set('status', 'shipped');

    // set value
    order.set('shipped', req.body.shipped === 'true');
  }

  /**
   * sanitise order address
   *
   * @param  {Object}  data
   *
   * @return {Promise}
   */
  async _sanitise(data) {
    // set order address
    const address = await data.order.get('address');

    // check address
    if (address) {
      // add address
      data.sanitised.address = address.sanitise ? await address.sanitise() : address;
      data.sanitised.shipped = data.order.get('shipped') || false;
      data.sanitised.tracking = data.order.get('tracking') || null;
    }
  }
}

/**
 * export shipping daemon class
 *
 * @type {shippingDaemon}
 */
module.exports = ShippingController;
