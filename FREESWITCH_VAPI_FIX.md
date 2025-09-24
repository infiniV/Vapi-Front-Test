# FreeSWITCH VAPI Integration Fix

## Issue Analysis
Based on the logs provided, FreeSWITCH is receiving inbound calls from VAPI (44.238.177.138) but they're being abandoned due to `WRONG_CALL_STATE`. This typically indicates:

1. **Dialplan routing issues** - The call doesn't know where to go
2. **ACL restrictions** - VAPI IP might not be allowed
3. **SIP profile configuration** - Context or routing problems

## Step-by-Step Fix

### 1. Check Current FreeSWITCH Configuration

```bash
# Check if FreeSWITCH is running
sudo systemctl status freeswitch

# Connect to FreeSWITCH CLI
fs_cli

# Check SIP profiles
sofia status profile internal

# Check recent calls
show calls
```

### 2. Fix ACL Configuration

Edit `/etc/freeswitch/autoload_configs/acl.conf.xml`:

```xml
<configuration name="acl.conf" description="Network Lists">
  <network-lists>
    <list name="domains" default="deny">
      <!-- Allow local network -->
      <node type="allow" cidr="192.168.1.0/24"/>
      <node type="allow" cidr="10.0.0.0/8"/>
      <!-- Allow VAPI IP -->
      <node type="allow" cidr="44.238.177.138/32"/>
      <!-- Allow other VAPI IPs if needed -->
      <node type="allow" cidr="44.238.0.0/16"/>
    </list>
  </network-lists>
</configuration>
```

### 3. Fix Public Dialplan

Edit `/etc/freeswitch/dialplan/public.xml`:

```xml
<include>
  <context name="public">
    
    <!-- VAPI Inbound Calls -->
    <extension name="vapi_inbound">
      <condition field="destination_number" expression="^(\+?18563997747)$">
        <action application="set" data="domain_name=$${domain}"/>
        <action application="transfer" data="1000 XML default"/>
      </condition>
    </extension>
    
    <!-- Fallback for any other VAPI calls -->
    <extension name="vapi_fallback">
      <condition field="network_addr" expression="^44\.238\.177\.138$">
        <action application="set" data="domain_name=$${domain}"/>
        <action application="transfer" data="1000 XML default"/>
      </condition>
    </extension>

    <!-- Default public extensions -->
    <extension name="public_extensions">
      <condition field="destination_number" expression="^(10[01][0-9])$">
        <action application="set" data="domain_name=$${domain}"/>
        <action application="transfer" data="$1 XML default"/>
      </condition>
    </extension>

  </context>
</include>
```

### 4. Verify Internal SIP Profile

Check `/etc/freeswitch/sip_profiles/internal.xml`:

```xml
<profile name="internal">
  <settings>
    <param name="context" value="public"/>
    <param name="rfc2833-pt" value="101"/>
    <param name="sip-port" value="$${internal_sip_port}"/>
    <param name="dialplan" value="XML"/>
    <param name="dtmf-duration" value="2000"/>
    <param name="inbound-codec-prefs" value="$${global_codec_prefs}"/>
    <param name="outbound-codec-prefs" value="$${global_codec_prefs}"/>
    <param name="hold-music" value="$${hold_music}"/>
    <param name="apply-nat-acl" value="nat.auto"/>
    <param name="apply-inbound-acl" value="domains"/>
    <param name="local-network-acl" value="localnet.auto"/>
    <param name="record-path" value="$${recordings_dir}"/>
    <param name="record-template" value="$${base_dir}/recordings/$${caller_id_number}.$${target_domain}.$${strftime(%Y-%m-%d-%H-%M-%S)}.wav"/>
  </settings>
</profile>
```

### 5. Create Extension 1000 (if it doesn't exist)

Edit `/etc/freeswitch/directory/default/1000.xml`:

```xml
<include>
  <user id="1000">
    <params>
      <param name="password" value="$${default_password}"/>
      <param name="vm-password" value="1000"/>
    </params>
    <variables>
      <variable name="toll_allow" value="domestic,international,local"/>
      <variable name="accountcode" value="1000"/>
      <variable name="user_context" value="default"/>
      <variable name="effective_caller_id_name" value="Extension 1000"/>
      <variable name="effective_caller_id_number" value="1000"/>
      <variable name="outbound_caller_id_name" value="$${outbound_caller_name}"/>
      <variable name="outbound_caller_id_number" value="$${outbound_caller_id}"/>
      <variable name="callgroup" value="techsupport"/>
    </variables>
  </user>
</include>
```

### 6. Apply Configuration Changes

```bash
# Method 1: Reload from FreeSWITCH CLI
fs_cli
> reloadxml
> sofia profile internal restart

# Method 2: Restart FreeSWITCH completely
sudo systemctl restart freeswitch

# Method 3: Reload specific configurations
fs_cli
> reloadacl
> reloadxml
```

### 7. Test the Configuration

```bash
# From FreeSWITCH CLI, monitor calls
fs_cli
> /log 7
> console loglevel 7

# Test call routing
> originate sofia/internal/1000@your-domain 1000

# Check if VAPI can register/connect
> sofia status profile internal reg
```

### 8. Monitor VAPI Calls

```bash
# Watch FreeSWITCH logs in real-time
tail -f /var/log/freeswitch/freeswitch.log

# From CLI, watch for VAPI calls
fs_cli
> /log 6
> console loglevel 6
```

## Common Issues and Solutions

### Issue: `Ping failed vapi with code 408`
**Solution**: VAPI is trying to ping your FreeSWITCH server but not getting a response.
- Check firewall settings
- Ensure port 5060 is open
- Verify your public IP in VAPI credential matches your actual IP

### Issue: `WRONG_CALL_STATE`
**Solution**: Call routing problems in dialplan.
- Check public.xml dialplan
- Ensure destination number matches your phone number
- Verify context settings

### Issue: Calls immediately hangup
**Solution**: ACL restrictions.
- Add VAPI IPs to domains ACL
- Check apply-inbound-acl settings
- Verify network configuration

## VAPI IP Addresses to Allow

Common VAPI IP ranges to add to your ACL:
```
44.238.177.138/32  (from your logs)
44.238.0.0/16      (VAPI IP range)
```

## Testing Commands

```bash
# Test SIP connectivity to VAPI
sudo nmap -p 5060 44.238.177.138

# Check if FreeSWITCH is listening
sudo netstat -tulpn | grep 5060

# Test DNS resolution
nslookup 44.238.177.138

# Check iptables rules
sudo iptables -L | grep 5060
```

After applying these fixes, your FreeSWITCH should properly handle inbound calls from VAPI.