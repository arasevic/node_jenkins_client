// this is the main file for the service

var amqp = require('amqplib/callback_api');
const { Client } = require('pg');
var jenkins = {};

node_jenkins_client = {};

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

// This parses the response for a build info request.
//
// My understanding is that, despite this not being in the
// documentation, there's an "artifacts" field in the JSON response
// with an array of artifact info. No idea yet what that info's format
// is.
node_jenkins_client.jenkins_parse_build = function(err,data) {
    if (err) throw err;
    return data; // XXX
}

// This gets the information about a Jenkins job, parses it, and
// returns the parsed data.
node_jenkins_client.jenkins_get_job = function(job_name,job_id) {
    return jenkins.build.get(job_name,
                             job_id,
                             node_jenkins_client.jenkins_parse_build);
}

// Handle the message from Jenkins that was published to RabbitMQ
node_jenkins_client.parse_build_status = function(msg) {
    // At the moment, we don't actually know what the format of this
    // is, nor what events trigger a message. Thanks, minimal
    // documentation!
    console.log(msg);
    // I *think* we'll be expecting:
    // {
    //   "project": "<name>",
    //   "number": "<build>",
    //   "status": "<status>"
    // }
    //
    // something else apparently gives us:
    // {
    //   "project": "<name>",
    //   "token": "<token>",
    //   "parameter": [
    //     {
    //       "name": "<param1>",
    //       "value": "<val1>"
    //     },
    //     {
    //       "name": "<param2>",
    //       "value": "<val2>"
    //     }
    //   ]
    // }
    //
    // No idea what these parameters might be, though.
}

module.exports = function(jenkins_url = undefined, rabbit_url = undefined, queue_name = undefined) {
    jenkins_url = jenkins_url || 'http://user:pass@localhost:8080';
    rabbit_url = rabbit_url || 'amqp://localhost';
    queue_name = queue_name || 'hello';
    jenkins = require('jenkins')({ baseUrl: jenkins_url, crumbIssuer: true });
    node_jenkins_client.listen(rabbit_url,
                               queue_name,
                               node_jenkins_client.parse_build_status);
}
