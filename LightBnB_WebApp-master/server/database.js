const properties = require('./json/properties.json');
const users = require('./json/users.json');

const { Pool } = require('pg');

const pool = new Pool({
  user: 'vagrant',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {

  const values = [email];
  return pool.query(`
  SELECT users.*
  FROM users
  WHERE users.email = $1; 
  `, values).then(res => {
    return res.rows.length ? res.rows[0] : null;
  });

}
exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  
  const values = [Number(id)];
  return pool.query(`
  SELECT users.*
  FROM users
  WHERE users.id = $1; 
  `, values).then(res => {
    return res.rows.length ? res.rows[0] : null;
  });

}
exports.getUserWithId = getUserWithId;


/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser =  function(user) {
  const { name, password, email } = user;
  const values = [name, email, password];
  return pool.query(`
  INSERT INTO users (name, email, password)
  VALUES ($1, $2, $3)
  RETURNING *;
  `, values).then(res => {
    return res.rows.length ? res.rows[0] : null;
  });

}
exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 10) {
  const values = [limit];
  return pool.query(
  `SELECT  reservations.*
        ,properties.*
        ,AVG(rating) AS average_rating
  FROM properties
  JOIN reservations
  ON properties.id = reservations.property_id
  JOIN property_reviews
  ON properties.id = property_reviews.property_id
  WHERE reservations.guest_id = 1 
  GROUP BY  reservations.id
            ,properties.id
  ORDER BY reservations.start_date
  LIMIT $1;`, values).then(res => {
    return res.rows.length ? res.rows : null;
  });
}
exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {
  const {
    city,
    owner_id,
    minimum_price_per_night,
    maximum_price_per_night,
    minimum_rating
  } = options;
  
  const queryValues = [];
  const whereStrings = [];
  const havingStrings = [];
  let queryString = '';

  queryString += `
    SELECT properties.*, avg(property_reviews.rating) as average_rating
    FROM properties
    JOIN property_reviews ON properties.id = property_id `;

  /* Checks if an option used and an option handled by WHERE */
  /* must update if adding a new WHERE filter */ 
  if(Object.keys(options).some(key => {
    console.log(key, options[key]);
    return options[key] && (
      key === 'city' ||
      key === 'owner_id' ||
      key === 'minimum_price_per_night' ||
      key === 'maximum_price_per_night' 
    );
  })) {
    queryString += 'WHERE ';
  
    if (city) {
      queryValues.push(`%${city}%`);
      whereStrings.push(`city LIKE $${queryValues.length}`);
    }
    if (owner_id) {
      queryValues.push(owner_id);
      whereStrings.push(`owner_id = $${queryValues.length}`);
    }
    if (minimum_price_per_night) {
      queryValues.push(Number(minimum_price_per_night) * 100);
      whereStrings.push(`cost_per_night >= $${queryValues.length}`);
    }
    if (maximum_price_per_night) {
      queryValues.push(Number(maximum_price_per_night) * 100);
      whereStrings.push(`cost_per_night <= $${queryValues.length}`);
    }
    queryString += whereStrings.length ? whereStrings.join(' AND ') + ' ' : '';
  }

  queryString += `GROUP BY properties.id `

  /* similar to above, checks if HAVING option used */
  if(Object.entries(options).some(op => {
    return op[1] && (
      'minimum_rating'
    ).includes(op[0]);
  })) {
    queryString += 'HAVING ';
    if(minimum_rating) {
      queryValues.push(Number(minimum_rating));
      havingStrings.push(`
      avg(property_reviews.rating) >= $${queryValues.length} `);
    }
    queryString += 
      havingStrings.length ?
      havingStrings.join(' AND ') + ' ' : '';
  }

  queryValues.push(limit);
  queryString += `
  ORDER BY cost_per_night
  LIMIT $${queryValues.length}`

  console.log(queryString, queryValues);
  return pool.query(queryString, queryValues).then(res => {
    console.log(res.rows.length);
    return res.rows;
  });
}

exports.getAllProperties = getAllProperties;


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  const propertyId = Object.keys(properties).length + 1;
  property.id = propertyId;
  properties[propertyId] = property;
  return Promise.resolve(property);
}
exports.addProperty = addProperty;
