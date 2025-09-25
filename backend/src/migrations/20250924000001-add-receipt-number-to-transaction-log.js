'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('transaction_log', 'receipt_number', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Receipt number when using booklet'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('transaction_log', 'receipt_number');
  }
};