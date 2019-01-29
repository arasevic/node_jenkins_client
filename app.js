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
node_jenkins_client.jenkins_parse_build = function(err,data) {
    console.log('in jenkins_parse_build');
    if (err) throw err;
    console.log(data);
    // The returned data has an 'artifacts' field, which is an array.
    // Here's a complete sample from a failed (null) build:
    const example_fail = {
        _class: 'hudson.model.FreeStyleBuild',
        actions:
        [ { _class: 'hudson.model.CauseAction', causes: [Array] },
          {},
          {} ],
        artifacts: [],
        building: false,
        description: null,
        displayName: '#10',
        duration: 81,
        estimatedDuration: 335,
        executor: null,
        fullDisplayName: 'foo #10',
        id: '10',
        keepLog: false,
        number: 10,
        queueId: 10,
        result: 'FAILURE',
        timestamp: 1548778636982,
        url: 'http://localhost:8080/job/foo/10/',
        builtOn: '',
        changeSet:
        { _class: 'hudson.scm.EmptyChangeLogSet', items: [], kind: null },
        culprits: []
    };
    // Here's a complete sample from a successful build with an artifact:
    const example_succeed = {
        _class: 'hudson.model.FreeStyleBuild',
        actions:
        [ { _class: 'hudson.model.CauseAction', causes: [Array] },
          {},
          {} ],
        artifacts: [
            { displayPath: 'bar', fileName: 'bar', relativePath: 'bar' }
        ],
        building: false,
        description: null,
        displayName: '#17',
        duration: 126,
        estimatedDuration: 165,
        executor: null,
        fullDisplayName: 'foo #17',
        id: '17',
        keepLog: false,
        number: 17,
        queueId: 17,
        result: 'SUCCESS',
        timestamp: 1548786655538,
        url: 'http://localhost:8080/job/foo/17/',
        builtOn: '',
        changeSet:
        { _class: 'hudson.scm.EmptyChangeLogSet', items: [], kind: null },
        culprits: []
    };


    console.log('returning from jenkins_parse_build');
    return data; // XXX
}

// This gets the information about a Jenkins job, parses it, and
// returns the parsed data.
node_jenkins_client.jenkins_get_job = function(job_name,job_id) {
    console.log('in jenkins_get_job');
    console.log(job_name);
    console.log(job_id);
    console.log('calling jenkins.build.get()');
    return jenkins.build.get(job_name,
                             job_id,
                             node_jenkins_client.jenkins_parse_build);
}

// Handle the message from Jenkins that was published to RabbitMQ
node_jenkins_client.parse_build_status = function(msg) {
    console.log('in parse_build_status');
    console.log(msg);

    const content = JSON.parse(msg.content);
    console.log(content);

    // This is probably not the right way to do this. Open to suggestions!
    if ( content.project == undefined ) {
        console.log('message does not have a project field');
        return;
    }
    if ( content.number == undefined ) {
        console.log('message does not have a number field');
        return;
    }
    if ( content.status == undefined ) {
        console.log('message does not have a status field');
        return;
    }

    var build_info = node_jenkins_client.jenkins_get_job(content.project,
                                                         content.number);
    console.log(build_info);
}

module.exports = function(jenkins_url = undefined,
                          rabbit_url = undefined,
                          queue_name = undefined) {
    jenkins_url = jenkins_url || 'http://user:pass@localhost:8080';
    rabbit_url = rabbit_url || 'amqp://localhost';
    queue_name = queue_name || 'hello';

    jenkins = require('jenkins')({ baseUrl: jenkins_url, crumbIssuer: true });
    jenkins.info(function(err,data) {
        if (err) {
            console.log('error',err);
        } else {
            console.log('connected to Jenkins');
            node_jenkins_client.listen(rabbit_url,
                                       queue_name,
                                       node_jenkins_client.parse_build_status);
        }
    });
}
