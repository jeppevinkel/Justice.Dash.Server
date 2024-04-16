'use strict';

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function (options, seedLink) {
    dbm = options.dbmigrate;
    type = dbm.dataType;
    seed = seedLink;
};

exports.up = function (db) {
    return db.createTable('images', {
        path: {
            type: 'varchar(255)',
            notNull: true,
        },
        prompt: {
            type: 'varchar(255)',
        },
        revised_prompt: {
            type: 'varchar(255)',
        },
        menu_date: {
            type: 'datetime',
            unique: true,
            notNull: false,
            foreignKey: {
                name: 'images_menus_date_fk',
                table: 'menus',
                mapping: 'date',
                rules: {
                    onDelete: 'SET NULL',
                    onUpdate: 'CASCADE',
                },
            },
        },
    });
};

exports.down = function (db) {
    return db.dropTable('images');
};

exports._meta = {
    'version': 1,
};
