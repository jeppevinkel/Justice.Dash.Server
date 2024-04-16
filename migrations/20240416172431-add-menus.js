'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  return db.createTable('menus', {
    date: {
      type: 'datetime',
      primaryKey: true,
      notNull: true,
    },
    day: {
      type: 'varchar(10)',
      notNull: true,
    },
    food_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    corrected_food_name: {
      type: 'varchar(255)',
      notNull: false,
    },
    food_contents: {
      type: 'longtext',
      notNull: false,
    },
    food_description: {
      type: 'varchar(255)',
      notNull: false,
    },
    week_number: {
      type: 'int',
      notNull: true,
    },
    manual: {
      type: 'tinyint(1)',
      notNull: true,
      default: 0
    }
  });
};

exports.down = function(db) {
  return db.dropTable('menus');
};

exports._meta = {
  "version": 1
};
