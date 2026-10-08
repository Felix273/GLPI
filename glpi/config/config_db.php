<?php
class DB extends DBmysql {
   public $dbhost = 'localhost';
   public $dbuser = 'glpi';
   public $dbpassword = '';
   public $dbdefault = 'glpi';
   public $use_timezones = true;
   public $use_utf8mb4 = true;
   public $allow_myisam = false;
   public $allow_datetime = false;
   public $allow_signed_keys = false;

   public function __construct($choice = null) {
       $this->dbhost = getenv('GLPI_DB_HOST') ?: $this->dbhost;
       $this->dbuser = getenv('GLPI_DB_USER') ?: $this->dbuser;
       $this->dbpassword = getenv('GLPI_DB_PASSWORD') ?: $this->dbpassword;
       $this->dbdefault = getenv('GLPI_DB_NAME') ?: $this->dbdefault;
       parent::__construct($choice);
   }
}
