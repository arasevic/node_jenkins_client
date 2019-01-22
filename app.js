// this is the main file for the service

var amqp = require('amqplib/callback_api');
const { Client } = require('pg');
var jenkins = require('jenkins')({ baseUrl: 'http://user:pass@localhost:8080', crumbIssuer: true });

node_jenkins_client = {}

// Here's what we're gonna do:
//  1. Listen on a RabbitMQ queue for "job finished" messages from Jenkins.
//  2. Parse those messages.
//  3. Pull any more metadata we need from Jenkins.
//  4. Store what we need to in PostgreSQL.
//     - Do we leave files on disk, and just stash paths?
//     - Do we store files (less than 1GB) in a BYTEA-type column?
//     - Do we store files (up to 4TB) as BLOBs, with OID's in the main table?

// General-purpose RabbitMQ listener.  For our purposes, "dispatcher"
// will be set to node_jenkins_client.parse_build_status.
node_jenkins_client.listen = function(rabbit_url, queue_name, dispatcher) {
    amqp.connect( rabbit_url,
                  function(err, conn) {
                      conn.createChannel( function(err, ch) {
                          ch.assertQueue( queue_name,
                                          {durable: true}
                                        );
                          ch.consume( queue_name, dispatcher, {noAck: true} );
                      })
                  }
                );
}

// Handle the message from Jenkins that was published to RabbitMQ
node_jenkins_client.parse_build_status = function(msg) {
    // At the moment, we don't actually know what the format of this
    // is, nor what events trigger a message. Thanks, minimal
    // documentation!
    console.log(msg);
}

module.exports = function(rabbit_url, queue_name) {
    rabbit_url = rabbit_url || 'amqp://localhost';
    queue_name = queue_name || 'hello';
    console.log('rabbit_url is', rabbit_url);
    console.log('queue_name is', queue_name);
    node_jenkins_client.listen(rabbit_url,
                               queue_name,
                               node_jenkins_client.parse_build_status);
}
