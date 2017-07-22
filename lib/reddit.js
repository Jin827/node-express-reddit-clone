"use strict";

var bcrypt = require('bcrypt-as-promised');
var HASH_ROUNDS = 10;

// This is a helper function to map a flat post to nested post
function transformPost(post) {
    return {
        id: post.posts_id,
        title: post.posts_title,
        url: post.posts_url,
        createdAt: post.posts_createdAt,
        updatedAt: post.posts_updatedAt,
        voteScore: post.voteScore,
        numUpvotes: post.numUpvotes,
        numDownvotes: post.numDownvotes,

        user: {
            id: post.users_id,
            username: post.users_username,
            createdAt: post.users_createdAt,
            updatedAt: post.users_updatedAt
        },
        subreddit: {
            id: post.subreddits_id,
            name: post.subreddits_name,
            description: post.subreddits_description,
            createdAt: post.subreddits_createdAt,
            updatedAt: post.subreddits_updatedAt
        }
    };
}

class RedditAPI {
    constructor(conn) {
        this.conn = conn;
    }

    /*
    user should have username and password
     */
    createUser(user) {
        /*
         first we have to hash the password. we will learn about hashing next week.
         the goal of hashing is to store a digested version of the password from which
         it is infeasible to recover the original password, but which can still be used
         to assess with great confidence whether a provided password is the correct one or not
         */
        return bcrypt.hash(user.password, HASH_ROUNDS)
        .then(hashedPassword => {
            return this.conn.query('INSERT INTO users (username, password, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())', [user.username, hashedPassword]);
        })
        .then(result => {
            return result.insertId;
        })
        .catch(error => {
            // Special error handling for duplicate entry
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('A user with this username already exists');
            }
            else {
                throw error;
            }
        });
    }

    /*
    post should have userId, title, url, subredditId
     */
    createPost(post) {
        if (!post.subredditId) {
            return Promise.reject(new Error("There is no subreddit id"));
        }

        return this.conn.query(
            `
                INSERT INTO posts (userId, title, url, createdAt, updatedAt, subredditId)
                VALUES (?, ?, ?, NOW(), NOW(), ?)`,
            [post.userId, post.title, post.url, post.subredditId]
        )
        .then(result => {
            return result.insertId;
        });
    }

    getAllPosts(subredditId, sortingMethod) {
        console.log(subredditId, sortingMethod)
        /*
         strings delimited with ` are an ES2015 feature called "template strings".
         they are more powerful than what we are using them for here. one feature of
         template strings is that you can write them on multiple lines. if you try to
         skip a line in a single- or double-quoted string, you would get a syntax error.

         therefore template strings make it very easy to write SQL queries that span multiple
         lines without having to manually split the string line by line.
         */
        var query;
        var mainString=
            `
            SELECT
                p.id AS posts_id,
                p.title AS posts_title,
                p.url AS posts_url,
                p.createdAt AS posts_createdAt,
                p.updatedAt AS posts_updatedAt, 
                p.subredditId AS posts_subreddit_id,
                
                u.id AS users_id,
                u.username AS users_username,
                u.createdAt AS users_createdAt,
                u.updatedAt AS users_updatedAt,
                
                s.id AS subreddits_id,
                s.name AS subreddits_name,
                s.description AS subreddits_description,
                s.createdAt AS subreddits_createdAt,
                s.updatedAt AS subreddits_updatedAt,
                
                v.createdAt,
                COALESCE(SUM(v.voteDirection), 0) AS voteScore,
                SUM(IF(v.voteDirection = 1, 1, 0)) AS numUpvotes,
                SUM(IF(v.voteDirection = -1, 1, 0)) AS numDownvotes
                
            FROM posts p
                JOIN users u ON p.userId = u.id
                JOIN subreddits s ON p.subredditId = s.id
                LEFT JOIN votes v ON p.id = v.postId ` 
             
        
        var condition1= ` GROUP BY p.id `
        var condition2= ` ORDER BY p.createdAt DESC ` 
        var condition3= ` LIMIT 25 `    
        var condition4= ` ORDER BY voteScore DESC `
        var condition5= ` ORDER BY voteScore / (NOW() - p.createdAt) DESC `
        var conditionsA= condition1 + condition2 + condition3
        var conditionsB= condition1 + condition4 + condition3
        var conditionsC= condition1 + condition5 + condition3
        
        
        if(subredditId){
            query= mainString + ` WHERE p.subredditId= ${subredditId} ` + conditionsA  
            console.log(query,"first query")
        }
        if(sortingMethod=== "top"){
            query= mainString + conditionsB
            console.log(query,"second query")
        }
        if(sortingMethod=== "hot"){
            query= mainString + conditionsC
            console.log(query,"third query")
        }
        else{
            query= mainString + conditionsA
            console.log(query,'forth query')
        }
        
        
        return this.conn.query(query)
        .then(function(posts) {
        // console.log(posts,"getAllPosts/reddit.js")
        return posts.map(transformPost)
        })
        
    }

    // Similar to previous function, but retrieves one post by its ID
    getSinglePost(postId) {
        return this.conn.query(
            `
            SELECT
                p.id AS posts_id,
                p.title AS posts_title,
                p.url AS posts_url,
                p.createdAt AS posts_createdAt,
                p.updatedAt AS posts_updatedAt, 
                
                u.id AS users_id,
                u.username AS users_username,
                u.createdAt AS users_createdAt,
                u.updatedAt AS users_updatedAt,
                
                s.id AS subreddits_id,
                s.name AS subreddits_name,
                s.description AS subreddits_description,
                s.createdAt AS subreddits_createdAt,
                s.updatedAt AS subreddits_updatedAt,
                
                COALESCE(SUM(v.voteDirection), 0) AS voteScore,
                SUM(IF(v.voteDirection = 1, 1, 0)) AS numUpvotes,
                SUM(IF(v.voteDirection = -1, 1, 0)) AS numDownvotes
                
            FROM posts p
                JOIN users u ON p.userId = u.id
                JOIN subreddits s ON p.subredditId = s.id
                LEFT JOIN votes v ON p.id = v.postId
                
            WHERE p.id = ?`,
            [postId]
        )
        .then(function(posts) {
            if (posts.length === 0) {
                return null;
            }
            else {
                return transformPost(posts[0]);
            }
        });
    }

    /*
    subreddit should have name and optional description
     */
    createSubreddit(subreddit) {
        return this.conn.query(
            `INSERT INTO subreddits (name, description, createdAt, updatedAt)
            VALUES(?, ?, NOW(), NOW())`, [subreddit.name, subreddit.description])
        .then(function(result) {
            return result.insertId;
        })
        .catch(error => {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('A subreddit with this name already exists');
            }
            else {
                throw error;
            }
        });
    }

    getAllSubreddits() {
        return this.conn.query(`
            SELECT id, name, description, createdAt, updatedAt
            FROM subreddits ORDER BY createdAt DESC`
        );
    }


    // check if a subreddit name is matches the given name, return a subreddit Object
    getSubredditByName(name){
                    // console.log(name,"ddd")

        return this.conn.query(`
            SELECT id, name, description, createdAt, updatedAt FROM subreddits s WHERE name = ?
        `, [name])
        .then(result =>{
            // console.log(result,"getSubredditByName result/ reddit.js")
            if(result.length ===0){
                return null
            }
            else{
                 var subredditObj = {
                                id: result[0].id,
                                name: result[0].name,
                                description: result[0].description,
                                createdAt: result[0].createdAt,
                                updatedAt: result[0].updatedAt
                                }
                // console.log(subredditObj,"output of getSubredditByName")
                return subredditObj 
            }
        })
    }
    
 

    /*
    vote must have postId, userId, voteDirection
     */
    createVote(vote) {
        if (vote.voteDirection !== 1 && vote.voteDirection !== -1 && vote.voteDirection !== 0) {
            return Promise.reject(new Error("voteDirection must be one of -1, 0, 1"));
        }

        return this.conn.query(`
            INSERT INTO votes (postId, userId, voteDirection)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE voteDirection = ?`,
            [vote.postId, vote.userId, vote.voteDirection, vote.voteDirection]
        );

    }

    /*
    comment must have userId, postId, text
     */
    createComment(comment) {
        return this.conn.query(`
            INSERT INTO comments (userId, postId, text, createdAt, updatedAt)
            VALUES (?, ?, ?, NOW(), NOW())`,
            [comment.userId, comment.postId, comment.text]
        )
        .then(result => {
            return result.insertId;
        });
    }

    getCommentsForPost(postId) {
        return this.conn.query(`
            SELECT
                c.id as comments_id,
                c.text as comments_text,
                c.createdAt as comments_createdAt,
                c.updatedAt as comments_updatedAt,
                
                u.id as users_id,
                u.username as users_username
                
            FROM comments c
                JOIN users u ON c.userId = u.id
                
            WHERE c.postId = ?
            ORDER BY c.createdAt DESC
            LIMIT 25`,
            [postId]
        )
        .then(function(results) {
            console.log(results)
            return results.map(function(result) {
                return {
                    id: result.comments_id,
                    text: result.comments_text,
                    createdAt: result.comments_createdAt,
                    updatedAt: result.comments_updatedAt,

                    user: {
                        id: result.users_id,
                        username: result.users_username
                    }
                };
            });
        });
    }


    checkUserLogin(username, password) {
        // console.log(username,password, 'username password INPUTTTTTT')
        return this.conn.query(`
            SELECT id, username, password FROM users WHERE username = ?
         `, [username])
         
         
        .then(data => {
            //  console.log(data, "DATAAAA FROM CHECK USER LOGIN !!!!")
            if(data.length === 0 ){
                throw new Error ("username or password incorrect")
            } 
            else {
                // console.log("this is data 000000000000 ", data[0])
                return bcrypt.compare(password, data[0].password);
            }
            })
            
        .then(result => {
            
            // console.log("This is the result of bcrypt.compare" + result);
            if(!result)
            {
                throw new Error("Wrong Password");
            }
                return this.conn.query (`SELECT id, username FROM users WHERE username = ?
         `, [username])
            //}
        })
        .catch(err=> {
            console.log(err,"username or password invalid")
        })
    }         
            
        
        
        
        
        
    /*
        Here are the steps you should follow:

            1. Find an entry in the users table corresponding to the input username
                a. If no user is found, make your promise throw an error "username or password incorrect".
                b. If you found a user, move to step 2
            2. Use the bcrypt.compare function to check if the database's hashed password matches the input password
                a. if it does, make your promise return the full user object minus the hashed password
                b. if it doesn't, make your promise throw an error "username or password incorrect"
         */
    


    createUserSession(userId) {
        // create session id
        var token;
        return bcrypt.genSalt(10)
        .then(sessionId => {
            token = sessionId;
            return this.conn.query(`
            INSERT INTO sessions (userId, token) VALUES ( ?, ? )`, [userId, token]
            )
        })
        .then(result => {
            return token;}
        )
        .catch(err => {console.log(err)})
    }
        
        
       
        /*
         Here are the steps you should follow:

         1. Use bcrypt's genSalt function to create a random string that we'll use as session id (promise)
         2. Use an INSERT statement to add the new session to the sessions table, using the input userId
         3. Once the insert is successful, return the random session id generated in step 1
         */
    

    //checi if the token represent a valid user
    getUserFromSession(sessionId) {
       return this.conn.query(`
       SELECT u.id, u.username, u.password, u.createdAt, u.updatedAt, s.userId, s.token
       FROM users u
       JOIN sessions s
       ON u.id = s.userId
       WHERE s.token = ?
       `, [sessionId])
       
       .then(result => {
        //   console.log(result,"give me something!!!!!")
           
           if(result.length === 0){
               throw new Error ("Error, try again")
           }
           else {
                 var obj = {
                        userId: result[0].id,
                        username: result[0].username,
                        password: result[0].password,
                        createAt: result[0].createdAt,
                        updatedAt: result[0].updatedAt,
                        sessionId: result[0].token
                        }
                // console.log(obj," output of user INFO")
                return obj
           }
       })
    }
}

module.exports = RedditAPI;


